import type { WeaponItem } from '../data/items';
import { TILE_SIZE } from '../data/tiles';
import type { SimEvent, World } from '../sim/world';
import { washed, type Sheet } from './atlas';

/** What the art pipeline (art3d/scripts/export_sprites.py) wrote beside the sheets. */
interface SpriteMeta {
  readonly size: number;
  /** Where the ground under the hero falls in a frame, in frame pixels from the top-left. */
  readonly feet: readonly [number, number];
  readonly swingFrames: number;
  /** The swing time (0 to 1) each sheet row was rendered at; row 0 is the rest pose. */
  readonly swingTimes: readonly number[];
  readonly armours: readonly string[];
  readonly weapons: readonly string[];
  readonly shields: readonly string[];
  readonly swingMs: Readonly<Record<string, number>>;
}

interface Layer {
  readonly image: Sheet;
  readonly hurt: Sheet;
}

/** The layered 8-facing hero: body sheets per outfit, weapon sheets with the swing, shield sheets. */
export interface HeroSprites {
  readonly meta: SpriteMeta;
  readonly layers: ReadonlyMap<string, Layer>;
}

/** The figure's facing and swing, kept by the view. The rules never read it. */
export interface HeroPose {
  facing: number;
  /** Seconds into the current swing, or -1 when not swinging. */
  swing: number;
}

const BLADES = new Set(['hand_axe', 'war_axe', 'battle_axe', 'long_sword', 'great_sword']);
/** How far the frame is drawn below the hero's middle: DCSS figures stand on the lower part of their cell. */
const FEET_DROP = 0.38;
/** A swing never lasts longer than this share of the time between blows, so the next one is not cut off. */
const SWING_SHARE = 0.85;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`스프라이트를 불러오지 못했다: ${url}`));
    image.src = url;
  });
}

/** Loads every sheet of a sprite set from public/sprites/<set>/. */
export async function loadHeroSprites(set: string): Promise<HeroSprites> {
  const base = `${import.meta.env.BASE_URL}sprites/${set}/`;
  const response = await fetch(`${base}sprites.json`);
  if (!response.ok) throw new Error(`스프라이트 목록을 불러오지 못했다: ${response.status}`);
  const meta = (await response.json()) as SpriteMeta;
  const names = [
    ...meta.armours.flatMap((a) => [`body_${a}_0`, `body_${a}_1`]),
    ...meta.weapons.map((w) => `weapon_${w}`),
    ...meta.shields.map((s) => `shield_${s}`),
  ];
  const images = await Promise.all(names.map((n) => loadImage(`${base}${n}.png`)));
  const layers = new Map<string, Layer>();
  names.forEach((name, i) => {
    const image = images[i];
    if (image) layers.set(name, { image, hurt: washed(image, 'rgba(210, 40, 30, 0.5)') });
  });
  return { meta, layers };
}

/** 0 = facing down the screen (S), then SE, E, NE, N, NW, W, SW: the column order of the sheets. */
export function facingIndex(dx: number, dy: number): number {
  const step = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return (((2 - step) % 8) + 8) % 8;
}

function weaponModel(weapon: WeaponItem): string | undefined {
  if (weapon.kind === 'staff' || weapon.kind === 'rod') return 'kk_staff';
  if (weapon.kind === 'wand') return undefined;
  if (BLADES.has(weapon.baseId)) return weapon.baseId;
  if (weapon.family === 'ranged') return 'shortbow';
  if (weapon.family === 'axe') return 'war_axe';
  if (weapon.family === 'blade') return 'long_sword';
  return undefined;
}

function armourName(w: World): string {
  const armour = w.gear.armour;
  if (armour === 'chain_mail') return 'chain';
  if (armour === 'leather_armour') return 'leather';
  return 'none';
}

export function makeHeroPose(): HeroPose {
  return { facing: 0, swing: -1 };
}

/** Turns toward whatever the hero just struck and starts the swing. */
export function takePoseEvents(pose: HeroPose, w: World, events: readonly SimEvent[]): void {
  if (!events.some((e) => e.type === 'swing')) return;
  let best: { dx: number; dy: number; d: number } | undefined;
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    const dx = m.x - w.hero.x;
    const dy = m.y - w.hero.y;
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { dx, dy, d };
  }
  if (best) pose.facing = facingIndex(best.dx, best.dy);
  pose.swing = 0;
}

/** Moves the pose on by `dt` seconds: walking turns the figure, a swing runs out. */
export function stepPose(pose: HeroPose, sprites: HeroSprites, w: World, dt: number): void {
  const h = w.hero;
  if (pose.swing >= 0) {
    pose.swing += dt;
    if (pose.swing >= swingSeconds(sprites, w)) pose.swing = -1;
  }
  const dx = h.x - h.px;
  const dy = h.y - h.py;
  if (pose.swing < 0 && h.moving && Math.hypot(dx, dy) > 1e-4) pose.facing = facingIndex(dx, dy);
}

function swingSeconds(sprites: HeroSprites, w: World): number {
  const model = weaponModel(w.weapon);
  const ms = (model && sprites.meta.swingMs[model]) || 500;
  return Math.min(ms / 1000, w.weapon.every * SWING_SHARE);
}

/** The swing row rendered nearest to time t (0 to 1) of the swing. */
function swingRow(meta: SpriteMeta, t: number): number {
  let row = 1;
  for (let r = 2; r < meta.swingTimes.length; r++) {
    if (Math.abs((meta.swingTimes[r] ?? 0) - t) < Math.abs((meta.swingTimes[row] ?? 0) - t)) row = r;
  }
  return row;
}

/**
 * Draws the hero's layers with the ground point at (cx, groundY): outfit, shield, then weapon.
 * Held things were rendered with the body cutting them, so drawing them on top is always right.
 */
export function drawHeroSprite(
  ctx: CanvasRenderingContext2D,
  sprites: HeroSprites,
  pose: HeroPose,
  w: World,
  cx: number,
  cy: number,
  px: number,
): void {
  const { meta, layers } = sprites;
  const scale = px / TILE_SIZE;
  const frame = meta.size * scale;
  const groundY = cy + px * FEET_DROP;
  const bob = w.hero.moving && pose.swing < 0 && Math.floor(w.time * 8) % 2 === 1 ? scale : 0;
  const x = Math.round(cx - meta.feet[0] * scale);
  const y = Math.round(groundY - meta.feet[1] * scale - bob);
  const hurt = w.hero.hurt > 0;
  const col = pose.facing * meta.size;

  const draw = (name: string, row: number): void => {
    const layer = layers.get(name);
    if (!layer) return;
    ctx.drawImage(hurt ? layer.hurt : layer.image, col, row * meta.size, meta.size, meta.size, x, y, frame, frame);
  };

  draw(`body_${armourName(w)}_${w.gear.helmet ? 1 : 0}`, 0);
  const shield = w.gear.offhand;
  if (shield && meta.shields.includes(shield)) draw(`shield_${shield}`, 0);
  const model = weaponModel(w.weapon);
  if (!model) return;
  const row = pose.swing >= 0 ? swingRow(meta, pose.swing / swingSeconds(sprites, w)) : 0;
  draw(`weapon_${model}`, row);
}

/** Draws the hero's current frame at the top-left of a frame-sized canvas, at the sprites' own size. */
export function drawHeroFrame(ctx: CanvasRenderingContext2D, sprites: HeroSprites, pose: HeroPose, w: World): void {
  const [feetX, feetY] = sprites.meta.feet;
  drawHeroSprite(ctx, sprites, pose, w, feetX, feetY - TILE_SIZE * FEET_DROP, TILE_SIZE);
}
