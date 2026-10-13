import * as THREE from 'three';
import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import type { World } from '../sim/world';
import type { Sheet } from '../view/atlas';
import { bleeds, corpseCanvas, leavesCorpse } from '../view/corpse';
import type { Figure } from './actors';
import { REMEMBERED } from './dungeon';
import { TileFigure, tileFigureHeight } from './tileFigures';

/** A figure that leaves no corpse fades where it fell over this long; a tile figure topples for TOPPLE first. */
const FADE_SECONDS = 2.6;
const TOPPLE_SECONDS = 0.34;
/** How long a corpse lies before it rots away, and how long the rotting takes, in seconds. */
const CORPSE_LINGER = 24;
const CORPSE_FADE = 2;
/** Blood stays for the floor, but only so many splashes are kept. */
const MAX_BLOOD = 90;
const SPLATS = Array.from({ length: 10 }, (_, i) => `misc/blood/blood_red0${i}` as TileName);
const PUDDLES = ['misc/blood/blood_puddle_red', ...[1, 2, 3, 4].map((i) => `misc/blood/blood_puddle_red${i}`)] as TileName[];

interface Dying {
  readonly actor: Figure;
  age: number;
  readonly life: number;
  /** Lays the corpse down once the figure has fallen; absent when the figure only fades. */
  readonly lay?: () => void;
}

interface Decal {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  readonly cell: { x: number; y: number };
  age: number;
  readonly life: number;
}

function crisp(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const pickOne = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!;

/**
 * What a kill leaves on the floor, as in DCSS: blood splashed on the tiles (natural creatures only)
 * and a corpse lying where the creature fell, cut through at the waist. Both are flat decals on the
 * ground, dimmed with the floor when out of sight.
 */
export class Remains {
  readonly group = new THREE.Group();
  private readonly plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private readonly tileTextures = new Map<TileName, THREE.CanvasTexture>();
  private readonly corpseTextures = new Map<TileName, THREE.CanvasTexture>();
  private corpses: Decal[] = [];
  private blood: Decal[] = [];
  private dying: Dying[] = [];
  private readonly colour = new THREE.Color();

  constructor(private readonly sheet: Sheet) {}

  /**
   * A creature of `kind` drawn as `tile` was just killed: it falls, bleeds, and a tile figure is
   * replaced by its corpse once down; anything else fades and sinks where it fell.
   */
  killed(kind: string, tile: TileName, actor: Figure): void {
    actor.die();
    const at = actor.root.position.clone();
    const size = tileFigureHeight(kind);
    this.bleed(kind, at.x, at.z, size);
    if (actor instanceof TileFigure && leavesCorpse(kind)) {
      const lay = (): void => void this.fall(kind, tile, at.x, at.z, size, actor.facingRight);
      this.dying.push({ actor, age: 0, life: TOPPLE_SECONDS, lay });
    } else {
      this.dying.push({ actor, age: 0, life: FADE_SECONDS });
    }
  }

  /** A creature of `kind`, `size` cells tall, has just died at (x, y): natural ones splash blood around. */
  private bleed(kind: string, x: number, y: number, size: number): void {
    if (!bleeds(kind)) return;
    this.splash(pickOne(size > 1.2 ? PUDDLES : SPLATS), x, y, size * 0.9);
    // A few drops thrown a little way off.
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.35 + Math.random() * 0.4;
      this.splash(pickOne(SPLATS), x + Math.cos(a) * r, y + Math.sin(a) * r, 0.5 + Math.random() * 0.3);
    }
  }

  /** Lays the corpse of `tile` down at (x, y), mirrored if the creature faced right; false when this kind leaves none. */
  private fall(kind: string, tile: TileName, x: number, y: number, size: number, flipped: boolean): boolean {
    if (!leavesCorpse(kind)) return false;
    const mesh = this.decal(this.corpseTexture(tile), x, y, size, 0.014);
    if (flipped) mesh.scale.x = -size;
    this.corpses.push({ mesh, cell: { x: Math.floor(x), y: Math.floor(y) }, age: 0, life: CORPSE_LINGER });
    return true;
  }

  update(w: World, dt: number): void {
    this.dying = this.dying.filter((d) => this.topple(d, dt));
    this.corpses = this.age(this.corpses, dt);
    this.sight(w, this.corpses);
    this.sight(w, this.blood);
  }

  clear(): void {
    for (const d of this.dying) d.actor.dispose();
    this.dying = [];
    for (const d of [...this.corpses, ...this.blood]) this.drop(d);
    this.corpses = [];
    this.blood = [];
  }

  /** Moves a falling figure on; false once it is gone (laid down as a corpse, or faded out). */
  private topple(d: Dying, dt: number): boolean {
    d.age += dt;
    d.actor.update(dt);
    const fade = (d.age - (d.life - 0.8)) / 0.8;
    if (fade > 0 && !d.lay) {
      d.actor.setOpacity(1 - fade);
      d.actor.root.position.y -= dt * 0.25;
    }
    if (d.age < d.life) return true;
    d.lay?.();
    d.actor.dispose();
    return false;
  }

  private splash(tile: TileName, x: number, y: number, size: number): void {
    const mesh = this.decal(this.tileTexture(tile), x, y, size, 0.008 + this.blood.length * 1e-5);
    mesh.rotation.y = Math.floor(Math.random() * 4) * (Math.PI / 2);
    this.blood.push({ mesh, cell: { x: Math.floor(x), y: Math.floor(y) }, age: 0, life: Infinity });
    while (this.blood.length > MAX_BLOOD) this.drop(this.blood.shift()!);
  }

  private decal(map: THREE.Texture, x: number, y: number, size: number, lift: number): Decal['mesh'] {
    const material = new THREE.MeshStandardMaterial({
      map,
      transparent: true,
      alphaTest: 0.4,
      depthWrite: false,
      roughness: 1,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const mesh = new THREE.Mesh(this.plane, material);
    mesh.position.set(x, lift, y);
    mesh.scale.set(size, 1, size);
    mesh.renderOrder = 1;
    this.group.add(mesh);
    return mesh;
  }

  private age(list: Decal[], dt: number): Decal[] {
    return list.filter((d) => {
      d.age += dt;
      const fade = (d.age - d.life) / CORPSE_FADE;
      if (fade >= 1) {
        this.drop(d);
        return false;
      }
      d.mesh.material.opacity = fade > 0 ? 1 - fade : 1;
      return true;
    });
  }

  /** Remains in sight show plainly, remembered ones dim like the floor under them, unseen ones not at all. */
  private sight(w: World, list: readonly Decal[]): void {
    for (const d of list) {
      const cell = d.cell.y * w.grid.w + d.cell.x;
      const level = w.visible[cell] ? 1 : w.seen[cell] ? REMEMBERED : 0;
      d.mesh.visible = level > 0;
      d.mesh.material.color.copy(this.colour.setScalar(level));
    }
  }

  private drop(d: Decal): void {
    d.mesh.removeFromParent();
    d.mesh.material.dispose();
  }

  private tileTexture(tile: TileName): THREE.CanvasTexture {
    let t = this.tileTextures.get(tile);
    if (!t) {
      const c = document.createElement('canvas');
      c.width = c.height = TILE_SIZE;
      const at = tileRect(tile);
      c.getContext('2d')?.drawImage(this.sheet, at.x, at.y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
      t = crisp(c);
      this.tileTextures.set(tile, t);
    }
    return t;
  }

  private corpseTexture(tile: TileName): THREE.CanvasTexture {
    let t = this.corpseTextures.get(tile);
    if (!t) {
      t = crisp(corpseCanvas(this.sheet, tile));
      this.corpseTextures.set(tile, t);
    }
    return t;
  }
}
