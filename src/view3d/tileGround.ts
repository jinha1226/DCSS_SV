import * as THREE from 'three';
import { tileRect, TILE_SIZE, type TileName } from '../data/tiles';
import { Cell, cellAt, type Grid } from '../sim/grid';
import { cellNoise } from '../sim/rng';
import type { World } from '../sim/world';
import type { Atlas } from '../view/atlas';
import type { Look } from '../view/look';
import { stairTile } from '../view/stairTile';
import { open, REMEMBERED, updateWaterSight, wallCaps, waterSurface, type GroundView } from './dungeon';

/** Wall blocks stand a little under a cell tall, so the camera sees over them to what is behind. */
const WALL_HEIGHT = 0.9;
/** The tops of walls: the same brick, in shadow. */
const TOP_SHADE = 0.42;
const SIDES = [
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
] as const;

/**
 * Makes a material draw one tile of the atlas per instance: each instance carries its tile's
 * rectangle (u, v, width, height) in a `tileUV` attribute that replaces the map coordinates.
 */
function atlasMaterial(map: THREE.Texture, shade = 1): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, color: new THREE.Color(shade, shade, shade) });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 tileUV;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = tileUV.xy + vMapUv * tileUV.zw;\n#endif');
  };
  material.customProgramCacheKey = () => 'atlas-tile';
  return material;
}

/** Where a tile sits in the atlas texture, inset half a texel so neighbours never bleed in. */
function tileUV(name: TileName, width: number, height: number): [number, number, number, number] {
  const at = tileRect(name);
  const inset = 0.5;
  return [
    (at.x + inset) / width,
    (height - at.y - TILE_SIZE + inset) / height,
    (TILE_SIZE - inset * 2) / width,
    (TILE_SIZE - inset * 2) / height,
  ];
}

function pick(set: readonly TileName[], x: number, y: number): TileName | undefined {
  return set[Math.floor(cellNoise(x, y) * set.length)];
}

interface Placed {
  readonly mesh: THREE.InstancedMesh;
  readonly index: number;
}

/**
 * The floor drawn with the DCSS tiles the flat view uses: a tile on every open cell and a block of
 * wall tiles wherever the wall meets open ground, all lit by the 3D torches and the hero's light.
 */
export class TileGround implements GroundView {
  readonly group = new THREE.Group();
  readonly torches: THREE.Vector3[] = [];
  private readonly texture: THREE.Texture;
  private byCell: Placed[][] = [];
  private shown = new Uint8Array(0);
  private flames: { sprite: THREE.Sprite; cell: number; phase: number }[] = [];
  private builtFor = -1;
  private water?: THREE.Mesh;
  private readonly colour = new THREE.Color();

  constructor(
    atlas: Atlas,
    private readonly look: Look,
    private readonly flameTexture: THREE.Texture,
  ) {
    this.texture = new THREE.Texture(atlas.image);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.needsUpdate = true;
  }

  async ensure(w: World): Promise<boolean> {
    if (w.depth === this.builtFor) return false;
    this.builtFor = w.depth;
    this.build(w);
    return true;
  }

  private clear(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
    });
    this.group.clear();
    this.torches.length = 0;
    this.flames = [];
    this.water = undefined;
  }

  private build(w: World): void {
    const grid = w.grid;
    this.clear();
    const { width, height } = this.texture.image as { width: number; height: number };
    this.byCell = Array.from({ length: grid.w * grid.h }, () => []);
    this.shown = new Uint8Array(grid.w * grid.h).fill(255);

    // Floor tiles: every open cell. Stairs show their own tile; a branch gateway, drawn with see-through
    // edges, lies over the floor tile.
    const floors: { cell: number; tile: TileName }[] = [];
    const gates: { cell: number; tile: TileName }[] = [];
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const kind = cellAt(grid, x, y);
        if (kind === Cell.Wall) continue;
        const stair = kind === Cell.StairsDown || kind === Cell.StairsUp ? stairTile(w, x, y, kind === Cell.StairsDown) : undefined;
        const gate = stair?.startsWith('dngn/gateways/');
        const tile = stair && !gate ? stair : pick(this.look.floor, x, y);
        if (tile) floors.push({ cell: y * grid.w + x, tile });
        if (stair && gate) gates.push({ cell: y * grid.w + x, tile: stair });
      }
    }
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const floorMesh = this.instanced(plane, atlasMaterial(this.texture), floors, grid, width, height, 0);
    floorMesh.receiveShadow = true;
    if (gates.length) {
      const gateMaterial = atlasMaterial(this.texture);
      gateMaterial.alphaTest = 0.5;
      this.instanced(plane.clone(), gateMaterial, gates, grid, width, height, 0.004).receiveShadow = true;
    }

    // Wall blocks: every wall cell touching open ground, sides in brick, top in shade.
    const walls: { cell: number; tile: TileName }[] = [];
    for (const cell of wallCaps(grid)) {
      const tile = pick(this.look.wall, cell % grid.w, Math.floor(cell / grid.w));
      if (tile) walls.push({ cell, tile });
    }
    const block = new THREE.BoxGeometry(1, WALL_HEIGHT, 1).translate(0, WALL_HEIGHT / 2, 0);
    const side = atlasMaterial(this.texture);
    const top = atlasMaterial(this.texture, TOP_SHADE);
    // Box faces: +x, -x, +y (top), -y, +z, -z.
    const wallMesh = this.instanced(block, [side, side, top, side, side, side], walls, grid, width, height, 0);
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;

    this.placeTorches(grid);
    this.water = waterSurface(grid, { water: 0x2a6f9a });
    if (this.water) this.group.add(this.water);
  }

  private instanced(
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    spots: readonly { cell: number; tile: TileName }[],
    grid: Grid,
    width: number,
    height: number,
    y: number,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, spots.length);
    const uv = new Float32Array(spots.length * 4);
    const m = new THREE.Matrix4();
    spots.forEach((spot, k) => {
      const x = spot.cell % grid.w;
      const z = Math.floor(spot.cell / grid.w);
      m.makeTranslation(x + 0.5, y, z + 0.5);
      mesh.setMatrixAt(k, m);
      mesh.setColorAt(k, this.colour.setRGB(0, 0, 0));
      uv.set(tileUV(spot.tile, width, height), k * 4);
      this.byCell[spot.cell]!.push({ mesh, index: k });
    });
    geometry.setAttribute('tileUV', new THREE.InstancedBufferAttribute(uv, 4));
    mesh.instanceMatrix.needsUpdate = true;
    this.group.add(mesh);
    return mesh;
  }

  /** Now and then a wall facing open ground carries a torch: a flickering flame and a light for the pool. */
  private placeTorches(grid: Grid): void {
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        if (open(grid, x, y)) continue;
        for (const s of SIDES) {
          if (!open(grid, x + s.dx, y + s.dy) || cellNoise(x * 3 + s.dx, y * 3 + s.dy) >= 0.07) continue;
          const px = x + 0.5 + s.dx * 0.53;
          const pz = y + 0.5 + s.dy * 0.53;
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({
              map: this.flameTexture,
              color: 0xffa040,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              transparent: true,
            }),
          );
          sprite.position.set(px, WALL_HEIGHT * 0.62, pz);
          sprite.scale.setScalar(0.42);
          sprite.visible = false;
          this.group.add(sprite);
          this.flames.push({ sprite, cell: (y + s.dy) * grid.w + x + s.dx, phase: cellNoise(x, y) * 10 });
          this.torches.push(new THREE.Vector3(px, WALL_HEIGHT * 0.62, pz));
        }
      }
    }
  }

  updateSight(w: World, time: number): void {
    const touched = new Set<THREE.InstancedMesh>();
    const n = Math.min(w.visible.length, this.shown.length);
    for (let cell = 0; cell < n; cell++) {
      const state = w.visible[cell] ? 2 : w.seen[cell] ? 1 : 0;
      if (state === this.shown[cell]) continue;
      this.shown[cell] = state;
      const level = state === 2 ? 1 : state === 1 ? REMEMBERED : 0;
      this.colour.setRGB(level, level, level * (state === 1 ? 1.12 : 1));
      for (const p of this.byCell[cell] ?? []) {
        p.mesh.setColorAt(p.index, this.colour);
        touched.add(p.mesh);
      }
    }
    for (const mesh of touched) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    for (const f of this.flames) {
      f.sprite.visible = Boolean(w.seen[f.cell]);
      f.sprite.scale.setScalar(0.38 + Math.sin(time * 12 + f.phase) * 0.04 + Math.sin(time * 7.7 + f.phase) * 0.03);
    }
    if (this.water) {
      (this.water.material as THREE.ShaderMaterial).uniforms.time!.value = time;
      updateWaterSight(this.water, w);
    }
  }
}
