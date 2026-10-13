import * as THREE from 'three';
import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import { washed, type Atlas, type Sheet } from '../view/atlas';
import { composeDoll, DOLL_CUT } from '../view/doll';
import { makeDollWalk, WALK_FRAMES, WALK_RATE } from '../view/walk';
import type { Figure, HeroFigure, HeroLook } from './actors';

/** How tall a tile figure stands, in cells: a little over one, like a DCSS tile seen from the side. */
export const TILE_HEIGHT = 1.12;
const BIG: Readonly<Record<string, number>> = { ogre: 1.45, hydra: 1.4, lair_yak: 1.3, swamp_drake: 1.25 };
const FLASH = 0.16;

/** A canvas holding one or more tile frames side by side, made into a crisp texture. */
function frames(source: Sheet, x: number, y: number, w: number, h: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) {
    g.imageSmoothingEnabled = false;
    g.drawImage(source, x, y, w, h, 0, 0, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = false;
  return t;
}

function tileTexture(source: Sheet, tile: TileName): THREE.CanvasTexture {
  const at = tileRect(tile);
  return frames(source, at.x, at.y, TILE_SIZE, TILE_SIZE);
}

let shadowTexture: THREE.CanvasTexture | undefined;
/** A soft dark oval that grounds a flat figure on the 3D floor. */
function shadow(width: number): THREE.Mesh {
  if (!shadowTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,0.6)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    shadowTexture = new THREE.CanvasTexture(c);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * 0.55),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * A DCSS tile standing on the 3D floor: a camera-facing sprite with its feet on the ground. It leans
 * back and snaps forward to strike, flashes white when struck, and tips over when it dies.
 */
export class TileFigure implements Figure {
  readonly root = new THREE.Group();
  protected readonly sprite: THREE.Sprite;
  protected readonly material: THREE.SpriteMaterial;
  protected readonly ground: THREE.Mesh;
  protected size: number;
  /** -1 faces left (as DCSS draws its tiles), 1 faces right. */
  protected facing = -1;
  protected dirX = 0;
  protected dirY = 1;
  protected moving = false;
  /** Frames side by side in each texture (1 for a monster tile, the walk's 4 for the hero). */
  protected frameCount = 1;
  protected frame = 0;
  private flash = 0;
  private lunge = -1;
  private lungeLength = 0.4;
  private dying = -1;
  private time = Math.random() * 10;

  constructor(
    protected normal: THREE.Texture,
    protected struck: THREE.Texture,
    size: number,
  ) {
    this.size = size;
    this.material = new THREE.SpriteMaterial({ map: normal, transparent: true, alphaTest: 0.35 });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.center.set(0.5, 0.04);
    this.sprite.renderOrder = 2;
    this.ground = shadow(size * 0.7);
    this.root.add(this.ground, this.sprite);
  }

  /** DCSS draws figures facing left; true once this one has turned to face right. */
  get facingRight(): boolean {
    return this.facing > 0;
  }

  get busy(): boolean {
    return this.lunge >= 0 || this.dying >= 0;
  }

  place(x: number, y: number, lift = 0): void {
    this.root.position.set(x, 0, y);
    this.sprite.position.y = lift;
    this.ground.scale.setScalar(1 - Math.min(0.5, lift));
  }

  face(dx: number, dy: number): void {
    if (Math.hypot(dx, dy) < 1e-4) return;
    this.dirX = dx;
    this.dirY = dy;
    if (Math.abs(dx) > 0.05) this.facing = dx < 0 ? -1 : 1;
  }

  move(speed: number): void {
    this.moving = speed > 0.25;
  }

  attack(seconds = 0.4): void {
    this.lunge = 0;
    this.lungeLength = Math.max(0.2, seconds);
  }

  hit(): void {
    this.flash = FLASH;
  }

  strike(amount = 1): void {
    this.flash = Math.max(this.flash, FLASH * amount);
  }

  die(): void {
    this.dying = 0;
    this.flash = FLASH;
  }

  setOpacity(value: number): void {
    this.material.opacity = value;
    (this.ground.material as THREE.MeshBasicMaterial).opacity = value;
  }

  /** How far forward (toward where it faces) the figure is pushed by a strike, 0..1 with wind-up below 0. */
  protected lean(): number {
    if (this.lunge < 0) return 0;
    const t = this.lunge / this.lungeLength;
    return t < 0.6 ? (-t / 0.6) * 0.5 : t < 0.8 ? -0.5 + ((t - 0.6) / 0.2) * 1.5 : 1 - (t - 0.8) / 0.2;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.lunge >= 0) {
      this.lunge += dt;
      if (this.lunge >= this.lungeLength) this.lunge = -1;
    }
    this.flash = Math.max(0, this.flash - dt);
    this.material.map = this.flash > 0 ? this.struck : this.normal;

    const d = Math.hypot(this.dirX, this.dirY) || 1;
    const push = this.lean() * 0.22;
    this.sprite.position.x = (this.dirX / d) * push;
    this.sprite.position.z = (this.dirY / d) * push;

    let height = this.size;
    const width = this.size;
    if (this.dying >= 0) {
      this.dying += dt;
      const t = Math.min(1, this.dying / 0.32);
      this.material.rotation = -this.facing * t * (Math.PI / 2);
      this.sprite.center.set(0.5, 0.04 + t * 0.4);
    } else if (this.moving) {
      // A small hop on each step.
      this.sprite.position.y += Math.abs(Math.sin(this.time * Math.PI * WALK_RATE * 0.5)) * 0.04;
    } else {
      // Breathing.
      height *= 1 + Math.sin(this.time * 2.4) * 0.015;
    }
    this.sprite.scale.set(width, height, 1);
    this.flipTextures();
  }

  /** The textures this figure shows, all laid out the same way. */
  protected textures(): THREE.Texture[] {
    return [this.normal, this.struck];
  }

  /**
   * Turns the figure by its texture coordinates: a sprite ignores negative scale, so facing right
   * (DCSS draws its figures facing left) reads the current frame back to front instead.
   */
  private flipTextures(): void {
    const span = 1 / this.frameCount;
    const flipped = this.facing > 0;
    for (const t of this.textures()) {
      t.repeat.x = flipped ? -span : span;
      t.offset.x = (this.frame + (flipped ? 1 : 0)) * span;
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.material.dispose();
    this.normal.dispose();
    this.struck.dispose();
  }
}

export function makeMonsterTile(atlas: Atlas, kind: string, tile: TileName): TileFigure {
  return new TileFigure(tileTexture(atlas.image, tile), tileTexture(atlas.struck, tile), BIG[kind] ?? TILE_HEIGHT);
}

export function tileFigureHeight(kind: string): number {
  return BIG[kind] ?? TILE_HEIGHT;
}

/** The hero as a DCSS player doll: the four-frame walk, a red wash when hurt, redressed whenever gear changes. */
export class HeroTile extends TileFigure implements HeroFigure {
  private hurtTexture: THREE.CanvasTexture;
  private layersKey = '';
  private hurtLeft = 0;
  private cheerLeft = 0;

  constructor(private readonly atlas: Atlas) {
    const blank = frames(document.createElement('canvas'), 0, 0, TILE_SIZE * WALK_FRAMES, TILE_SIZE);
    super(blank, blank.clone(), TILE_HEIGHT);
    this.hurtTexture = blank.clone();
    this.frameCount = WALK_FRAMES;
  }

  /** Recomposes the doll from its layers (species, outfit, worn gear, wielded weapon). */
  async dress(look: HeroLook): Promise<void> {
    const layers = look.layers ?? [];
    const key = layers.join('|');
    if (key === this.layersKey || !layers.length) return;
    this.layersKey = key;
    const walk = makeDollWalk(composeDoll(this.atlas.image, layers), DOLL_CUT);
    const replace = (old: THREE.Texture, source: Sheet): THREE.CanvasTexture => {
      old.dispose();
      return frames(source, 0, 0, TILE_SIZE * WALK_FRAMES, TILE_SIZE);
    };
    const normal = replace(this.normal, walk.image);
    const struck = replace(this.struck, washed(walk.image, 'rgba(255, 246, 220, 0.55)'));
    this.hurtTexture = replace(this.hurtTexture, walk.hurt);
    this.normal = normal;
    this.struck = struck;
    this.material.map = normal;
  }

  protected override textures(): THREE.Texture[] {
    return [this.normal, this.struck, this.hurtTexture];
  }

  override hit(): void {
    super.hit();
    this.hurtLeft = 0.35;
  }

  cast(seconds: number): void {
    this.attack(seconds);
  }

  throwAt(seconds: number): void {
    this.attack(seconds);
  }

  hop(): void {
    // The jump arc comes from the rules' own hop path; nothing extra to draw.
  }

  cheer(): void {
    this.cheerLeft = 1;
  }

  block(): void {
    this.strike(0.6);
  }

  override update(dt: number): void {
    this.frame = this.moving ? Math.floor(performance.now() / (1000 / WALK_RATE)) % WALK_FRAMES : 0;
    super.update(dt);
    this.hurtLeft = Math.max(0, this.hurtLeft - dt);
    if (this.hurtLeft > 0 && this.material.map === this.normal) this.material.map = this.hurtTexture;
    if (this.cheerLeft > 0) {
      this.cheerLeft = Math.max(0, this.cheerLeft - dt);
      this.sprite.position.y += Math.abs(Math.sin(this.cheerLeft * Math.PI * 3)) * 0.25;
    }
  }

  override dispose(): void {
    super.dispose();
    this.hurtTexture.dispose();
  }
}
