import * as THREE from 'three';
import { itemDefinition } from '../data/itemCatalog';
import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import type { World } from '../sim/world';
import type { Sheet } from '../view/atlas';
import { heldFor } from './actors';
import { glowTexture, lightMaterial } from './glyphs';
import type { ModelLibrary } from './models';

/** What lies on the floor, the stair being held, and the floor's goal. */
export class LootView {
  readonly group = new THREE.Group();
  private readonly glow = glowTexture();
  private readonly loot = new Map<string, THREE.Object3D>();
  private readonly tiles = new Map<string, THREE.SpriteMaterial>();
  private stairsRing?: THREE.Mesh;
  private objective?: THREE.Object3D;

  constructor(
    private readonly models: ModelLibrary,
    private readonly atlas: Sheet,
    /** Show every item, weapons too, as its DCSS tile rather than a 3D model. */
    private readonly tilesOnly = false,
  ) {}

  private orb(colour: THREE.ColorRepresentation, size: number): THREE.Sprite {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glow, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    s.scale.setScalar(size);
    return s;
  }

  private tileMaterial(name: TileName): THREE.SpriteMaterial {
    let m = this.tiles.get(name);
    if (m) return m;
    const c = document.createElement('canvas');
    c.width = c.height = TILE_SIZE;
    const g = c.getContext('2d');
    const at = tileRect(name);
    if (g) {
      g.imageSmoothingEnabled = false;
      g.drawImage(this.atlas, at.x, at.y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
    }
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.SpriteMaterial({ map: t, transparent: true });
    this.tiles.set(name, m);
    return m;
  }

  private async lootMesh(item: World['groundItems'][number]): Promise<THREE.Object3D> {
    const g = new THREE.Group();
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lightMaterial(this.glow, 0xffe6a8, 0.4));
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.03;
    g.add(halo);
    if (item.kind === 'gold') {
      const coins = await this.models.instance('dungeon/coin_stack_small.glb');
      coins.scale.setScalar(0.45);
      g.add(coins);
      (halo.material as THREE.MeshBasicMaterial).color.set(0xffcf4a);
      return g;
    }
    if (item.kind === 'axe' && item.axe && !this.tilesOnly) {
      const held = heldFor(item.axe);
      if (held.model) {
        const weapon = await this.models.instance(held.model);
        weapon.scale.setScalar(0.5);
        weapon.rotation.set(Math.PI / 2, 0, Math.PI / 4);
        weapon.position.y = 0.12;
        g.add(weapon);
        g.userData.spin = weapon;
      }
      if (item.axe.special) (halo.material as THREE.MeshBasicMaterial).color.set(0xffb04a);
      else if (item.axe.brand) (halo.material as THREE.MeshBasicMaterial).color.set(0x8ad0ff);
      return g;
    }
    const tile =
      item.kind === 'ammo'
        ? 'item/boomerang1'
        : item.axe
          ? item.axe.tile
          : item.itemId
            ? (itemDefinition(item.itemId).tile as TileName)
            : undefined;
    if (tile) {
      const sprite = new THREE.Sprite(this.tileMaterial(tile));
      sprite.scale.setScalar(0.55);
      sprite.position.y = 0.38;
      g.add(sprite);
      g.userData.bob = sprite;
    }
    return g;
  }

  /** Shows what lies on the floor, rebuilt as items appear and are picked up. */
  syncLoot(w: World, time: number): void {
    const live = new Set<string>();
    for (const item of w.groundItems) {
      const cell = Math.floor(item.y) * w.grid.w + Math.floor(item.x);
      live.add(item.uid);
      let mesh = this.loot.get(item.uid);
      if (!mesh) {
        const holder = new THREE.Group();
        this.loot.set(item.uid, holder);
        this.group.add(holder);
        void this.lootMesh(item).then((m) => holder.add(m));
        mesh = holder;
      }
      mesh.visible = Boolean(w.seen[cell]);
      mesh.position.set(item.x, 0, item.y);
      const inner = mesh.children[0];
      const spin = inner?.userData.spin as THREE.Object3D | undefined;
      const bob = inner?.userData.bob as THREE.Object3D | undefined;
      if (spin) spin.rotation.z = time * 1.2;
      if (bob) bob.position.y = 0.38 + Math.sin(time * 3 + item.x) * 0.05;
    }
    for (const [uid, mesh] of this.loot) {
      if (live.has(uid)) continue;
      mesh.removeFromParent();
      this.loot.delete(uid);
    }
  }

  /** Progress ring on the stair being held, and the floor's goal shining where it is visible. */
  syncMarkers(
    w: World,
    stairProgress: number,
    stair: { x: number; y: number } | undefined,
    objective: { x: number; y: number; kind: string } | undefined,
    time: number,
  ): void {
    if (!this.stairsRing) {
      this.stairsRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 64, 1, 0, Math.PI * 2), lightMaterial(this.glow, 0xffd27a, 1));
      (this.stairsRing.material as THREE.MeshBasicMaterial).map = null;
      this.stairsRing.rotation.x = -Math.PI / 2;
      this.group.add(this.stairsRing);
    }
    this.stairsRing.visible = Boolean(stair && stairProgress > 0);
    if (stair && stairProgress > 0) {
      this.stairsRing.geometry.dispose();
      this.stairsRing.geometry = new THREE.RingGeometry(0.42, 0.52, 64, 1, Math.PI / 2, -Math.PI * 2 * Math.min(1, stairProgress));
      this.stairsRing.position.set(stair.x + 0.5, 0.07, stair.y + 0.5);
    }
    if (!this.objective) {
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22),
        new THREE.MeshStandardMaterial({ color: 0xe9c96e, emissive: 0xe9c96e, emissiveIntensity: 0.8, roughness: 0.2, metalness: 0.3 }),
      );
      const light = new THREE.PointLight(0xffe0a0, 3, 4, 1.5);
      const holder = new THREE.Group();
      holder.add(crystal, light, this.orb(0xffe6a8, 1.1));
      this.objective = holder;
      this.group.add(holder);
    }
    const visible = objective && w.visible[Math.floor(objective.y) * w.grid.w + Math.floor(objective.x)];
    this.objective.visible = Boolean(visible);
    if (objective && visible) {
      const tint = objective.kind === 'orb' ? 0xd8a9ff : 0xe9c96e;
      const crystal = this.objective.children[0] as THREE.Mesh;
      const m = crystal.material as THREE.MeshStandardMaterial;
      m.color.set(tint);
      m.emissive.set(tint);
      this.objective.position.set(objective.x, 0.6 + Math.sin(time * 2) * 0.08, objective.y);
      crystal.rotation.y = time * 1.4;
    }
  }

  clearFloor(): void {
    for (const m of this.loot.values()) m.removeFromParent();
    this.loot.clear();
  }
}
