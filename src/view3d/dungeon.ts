import * as THREE from 'three';
import { Cell, cellAt, type Grid } from '../sim/grid';
import { cellNoise } from '../sim/rng';
import type { World } from '../sim/world';
import { MODEL_SCALE, type ModelLibrary } from './models';

/** Wall height in cells: low enough that the camera sees over a wall to whoever stands behind it. */
export const WALL_HEIGHT = 1.05;
/** How bright remembered (out of sight) ground is drawn. */
const REMEMBERED = 0.3;
const SIDES = [
  { dx: 0, dy: 1, angle: 0 },
  { dx: 0, dy: -1, angle: Math.PI },
  { dx: 1, dy: 0, angle: Math.PI / 2 },
  { dx: -1, dy: 0, angle: -Math.PI / 2 },
] as const;

interface Theme {
  readonly floors: readonly string[];
  /** Chance per floor cell of a plain tile; the rest pick a variant. */
  readonly plain: number;
  readonly tint: THREE.ColorRepresentation;
  readonly cap: THREE.ColorRepresentation;
  readonly water: THREE.ColorRepresentation;
}

const THEMES: Record<string, Theme> = {
  Dungeon: {
    floors: [
      'floor_tile_small',
      'floor_tile_small_broken_A',
      'floor_tile_small_broken_B',
      'floor_tile_small_decorated',
      'floor_tile_small_weeds_A',
    ],
    plain: 0.72,
    tint: 0xffffff,
    cap: 0x3a332c,
    water: 0x2a6f9a,
  },
  Lair: {
    floors: ['floor_dirt_small_A', 'floor_dirt_small_B', 'floor_dirt_small_weeds'],
    plain: 0.5,
    tint: 0xe6dccb,
    cap: 0x3a3226,
    water: 0x2c6f86,
  },
  Swamp: {
    floors: ['floor_dirt_small_A', 'floor_dirt_small_weeds', 'floor_dirt_small_B'],
    plain: 0.45,
    tint: 0xb9c7a4,
    cap: 0x2c3224,
    water: 0x3c5a3a,
  },
};

/** Where an instanced piece sits and which cell's sight it follows. */
interface Placed {
  readonly mesh: THREE.InstancedMesh;
  readonly index: number;
  readonly cell: number;
}

/** The floor of one level as instanced KayKit pieces, lit or darkened by what the hero can see. */
export class DungeonView {
  readonly group = new THREE.Group();
  /** Torch positions (world units) for the light pool to pick from. */
  readonly torches: THREE.Vector3[] = [];
  private placed: Placed[] = [];
  private byCell: Placed[][] = [];
  private shown = new Uint8Array(0);
  private meshes: THREE.InstancedMesh[] = [];
  private builtFor = -1;
  private readonly colour = new THREE.Color();
  private water?: THREE.Mesh;

  constructor(private readonly models: ModelLibrary) {}

  /** Rebuilds the pieces when the hero is on a new floor. Returns true when it rebuilt. */
  async ensure(w: World): Promise<boolean> {
    const key = w.depth;
    if (key === this.builtFor) return false;
    this.builtFor = key;
    await this.build(w);
    return true;
  }

  private clear(): void {
    for (const m of this.meshes) m.dispose();
    this.group.clear();
    this.meshes = [];
    this.placed = [];
    this.torches.length = 0;
    this.water = undefined;
  }

  private async build(w: World): Promise<void> {
    const grid = w.grid;
    const branch = w.dungeonGraph.nodes.get(w.depth)?.branch ?? 'Dungeon';
    const theme = THEMES[branch] ?? THEMES.Dungeon!;
    const plan = planPieces(grid, theme);
    const names = [...new Set([...plan.keys()])];
    const pieces = await Promise.all(names.map((n) => this.models.piece(`dungeon/${n}.glb`)));
    this.clear();
    this.byCell = Array.from({ length: grid.w * grid.h }, () => []);
    this.shown = new Uint8Array(grid.w * grid.h).fill(255);

    names.forEach((name, i) => {
      const piece = pieces[i]!;
      const spots = plan.get(name)!;
      const material = (piece.material as THREE.MeshStandardMaterial).clone();
      if (name.startsWith('floor')) material.color.set(theme.tint);
      const mesh = new THREE.InstancedMesh(piece.geometry, material, spots.length);
      mesh.receiveShadow = true;
      mesh.castShadow = !name.startsWith('floor');
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      spots.forEach((spot, k) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spot.angle);
        s.set(MODEL_SCALE * spot.scale[0], MODEL_SCALE * spot.scale[1], MODEL_SCALE * spot.scale[2]);
        m.compose(new THREE.Vector3(spot.x, spot.y, spot.z), q, s);
        mesh.setMatrixAt(k, m);
        mesh.setColorAt(k, this.colour.setRGB(0, 0, 0));
        const placed = { mesh, index: k, cell: spot.cell };
        this.placed.push(placed);
        this.byCell[spot.cell]!.push(placed);
        if (name === 'torch_mounted') this.torches.push(new THREE.Vector3(spot.x, spot.y + 0.45, spot.z));
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.meshes.push(mesh);
      this.group.add(mesh);
    });

    // Wall tops: a dark slab over every wall cell that borders open ground, closing the walls into blocks.
    const caps = wallCaps(grid);
    const capMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 0.06, 1),
      new THREE.MeshStandardMaterial({ color: theme.cap, roughness: 1 }),
      caps.length,
    );
    const m = new THREE.Matrix4();
    caps.forEach((cell, k) => {
      const x = cell % grid.w;
      const y = Math.floor(cell / grid.w);
      m.makeTranslation(x + 0.5, WALL_HEIGHT + 0.03, y + 0.5);
      capMesh.setMatrixAt(k, m);
      capMesh.setColorAt(k, this.colour.setRGB(0, 0, 0));
      const placed = { mesh: capMesh, index: k, cell };
      this.placed.push(placed);
      this.byCell[cell]!.push(placed);
    });
    this.meshes.push(capMesh);
    this.group.add(capMesh);

    this.water = waterSurface(grid, theme);
    if (this.water) this.group.add(this.water);
  }

  /** Lights what is in sight, dims what is remembered, hides the rest. */
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
    if (this.water) {
      const material = this.water.material as THREE.ShaderMaterial;
      material.uniforms.time!.value = time;
      updateWaterSight(this.water, w);
    }
  }
}

interface Spot {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly angle: number;
  readonly scale: readonly [number, number, number];
  readonly cell: number;
}

function open(grid: Grid, x: number, y: number): boolean {
  return cellAt(grid, x, y) !== Cell.Wall;
}

/** Which piece goes where: floor tiles, wall faces toward open ground, torches and a little clutter. */
function planPieces(grid: Grid, theme: Theme): Map<string, Spot[]> {
  const plan = new Map<string, Spot[]>();
  const add = (name: string, spot: Spot): void => {
    const list = plan.get(name);
    if (list) list.push(spot);
    else plan.set(name, [spot]);
  };
  const wallScale = WALL_HEIGHT / (4 * MODEL_SCALE);
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const cell = y * grid.w + x;
      const kind = cellAt(grid, x, y);
      if (kind !== Cell.Wall) {
        if (kind === Cell.StairsDown) {
          // A stairwell: no floor tile, steps going down into the dark.
          add('stairs', { x: x + 0.5, y: -0.55, z: y + 0.5, angle: Math.PI, scale: [0.4, 0.22, 0.5], cell });
          continue;
        }
        const r = cellNoise(x, y);
        const floors = theme.floors;
        const name = r < theme.plain ? floors[0]! : floors[1 + Math.floor(cellNoise(y + 31, x + 7) * (floors.length - 1))]!;
        const turn = Math.floor(cellNoise(x + 13, y + 5) * 4) * (Math.PI / 2);
        add(name, { x: x + 0.5, y: -0.075, z: y + 0.5, angle: turn, scale: [1, 1, 1], cell });
        if (kind === Cell.StairsUp) {
          add('stairs', { x: x + 0.5, y: 0, z: y + 0.5, angle: 0, scale: [0.4, 0.12, 0.5], cell });
          continue;
        }
        clutter(grid, x, y, cell, add);
        continue;
      }
      for (const side of SIDES) {
        if (!open(grid, x + side.dx, y + side.dy)) continue;
        // The face sits inside the wall cell, flush with the edge it faces.
        const fx = x + 0.5 + side.dx * 0.25;
        const fz = y + 0.5 + side.dy * 0.25;
        add('wall_half', { x: fx, y: 0, z: fz, angle: side.angle, scale: [1, wallScale, 1], cell });
        if (cellNoise(x * 3 + side.dx, y * 3 + side.dy) < 0.07) {
          add('torch_mounted', {
            x: x + 0.5 + side.dx * 0.52,
            y: WALL_HEIGHT * 0.55,
            z: y + 0.5 + side.dy * 0.52,
            angle: side.angle,
            scale: [1.2, 1.2, 1.2],
            cell: (y + side.dy) * grid.w + x + side.dx,
          });
        }
      }
    }
  }
  return plan;
}

/** Barrels and crates against walls, and the odd pillar; decoration only, never in a doorway. */
function clutter(grid: Grid, x: number, y: number, cell: number, add: (name: string, spot: Spot) => void): void {
  const walls = SIDES.filter((s) => !open(grid, x + s.dx, y + s.dy));
  if (walls.length !== 1) return;
  const r = cellNoise(x + 101, y + 57);
  if (r > 0.06) return;
  const side = walls[0]!;
  const names = ['barrel_small', 'barrel_large', 'crates_stacked', 'box_small', 'rubble_half'];
  const name = names[Math.floor(cellNoise(x + 7, y + 211) * names.length)]!;
  add(name, {
    x: x + 0.5 + side.dx * 0.28,
    y: 0,
    z: y + 0.5 + side.dy * 0.28,
    angle: cellNoise(x, y + 3) * Math.PI * 2,
    scale: [0.8, 0.8, 0.8],
    cell,
  });
}

function wallCaps(grid: Grid): number[] {
  const caps: number[] = [];
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      if (open(grid, x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (open(grid, x + dx, y + dy)) near = true;
      if (near) caps.push(y * grid.w + x);
    }
  }
  return caps;
}

/** One mesh of quads over the water cells, with a shimmering shader and a per-cell sight value. */
function waterSurface(grid: Grid, theme: Theme): THREE.Mesh | undefined {
  const cells: number[] = [];
  for (let i = 0; i < grid.cells.length; i++) if (grid.cells[i] === Cell.Water) cells.push(i);
  if (!cells.length) return undefined;
  const position = new Float32Array(cells.length * 12);
  const sight = new Float32Array(cells.length * 4);
  const index: number[] = [];
  cells.forEach((cell, k) => {
    const x = cell % grid.w;
    const y = Math.floor(cell / grid.w);
    position.set([x, 0.02, y, x + 1, 0.02, y, x + 1, 0.02, y + 1, x, 0.02, y + 1], k * 12);
    const b = k * 4;
    index.push(b, b + 2, b + 1, b, b + 3, b + 2);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('sight', new THREE.BufferAttribute(sight, 1));
  geometry.setIndex(index);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { time: { value: 0 }, tint: { value: new THREE.Color(theme.water) } },
    vertexShader: `
      attribute float sight;
      varying float vSight;
      varying vec2 vXZ;
      void main() {
        vSight = sight;
        vXZ = position.xz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float time;
      uniform vec3 tint;
      varying float vSight;
      varying vec2 vXZ;
      void main() {
        float w = sin(vXZ.x * 3.1 + time * 1.7) * sin(vXZ.y * 2.7 - time * 1.3);
        float glint = smoothstep(0.82, 1.0, w) * 0.5;
        vec3 c = tint * (0.75 + 0.25 * w) + glint;
        gl_FragColor = vec4(c * vSight, 0.72 * step(0.01, vSight));
      }`,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.cells = cells;
  return mesh;
}

function updateWaterSight(mesh: THREE.Mesh, w: World): void {
  const cells = mesh.userData.cells as number[];
  const attr = mesh.geometry.getAttribute('sight') as THREE.BufferAttribute;
  let changed = false;
  cells.forEach((cell, k) => {
    const v = w.visible[cell] ? 1 : w.seen[cell] ? REMEMBERED : 0;
    if (attr.getX(k * 4) === v) return;
    for (let j = 0; j < 4; j++) attr.setX(k * 4 + j, v);
    changed = true;
  });
  if (changed) attr.needsUpdate = true;
}
