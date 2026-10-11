import { ARTEFACTS, AXES, BRANDS, EQUIPMENT, NAME_PARTS, RANDART_OPTIONS, axeBase, type AxeItem, type AxeOption } from '../data/items';
import { Cell, cellAt, walkable } from './grid';
import type { World } from './types';

const RANDART = [0.1, 0.3, 0.5] as const;
const BRAND = [0.12, 0.3, 0.5] as const;
const PICKUP_RADIUS = 0.55;
const PICKUP_RELEASE_RADIUS = 0.8;
const rollInt = (w: World, lo: number, hi: number): number => lo + Math.floor(w.rng() * (hi - lo + 1));
const uid = (w: World, prefix: string): string => prefix + '-' + w.depth + '-' + w.nextItem++;

function weightedAxe(w: World): (typeof AXES)[number] {
  const index = Math.max(0, Math.min(2, w.depth - 1));
  const total = AXES.reduce((sum, axe) => sum + (axe.depthWeights[index] ?? 0), 0);
  let roll = w.rng() * total;
  for (const axe of AXES) {
    roll -= axe.depthWeights[index] ?? 0;
    if (roll <= 0) return axe;
  }
  return AXES[0]!;
}
const randomBrand = (w: World): string => BRANDS[Math.floor(w.rng() * BRANDS.length)]!.id;
function option(w: World, row: (typeof RANDART_OPTIONS)[number]): AxeOption {
  const steps = Math.round((row.max - row.min) / row.step);
  return { id: row.id, name: row.name, value: row.min + rollInt(w, 0, steps) * row.step };
}
function randartName(w: World, base: string): string {
  const a = NAME_PARTS.prefixes[Math.floor(w.rng() * NAME_PARTS.prefixes.length)] ?? '카르';
  const b = NAME_PARTS.suffixes[Math.floor(w.rng() * NAME_PARTS.suffixes.length)] ?? '둠';
  return a + b + '의 ' + base;
}
export function generateAxe(w: World): AxeItem {
  const base = weightedAxe(w),
    index = Math.max(0, Math.min(2, w.depth - 1));
  const isRandart = w.rng() < RANDART[index]!;
  const brand = isRandart || w.rng() < BRAND[index]! ? randomBrand(w) : undefined;
  const options: AxeOption[] = [];
  if (isRandart) {
    const pool = [...RANDART_OPTIONS],
      count = rollInt(w, 2, 3);
    while (options.length < count && pool.length) {
      const at = Math.floor(w.rng() * pool.length);
      options.push(option(w, pool.splice(at, 1)[0]!));
    }
  }
  return {
    uid: uid(w, 'axe'),
    baseId: base.id,
    name: isRandart ? randartName(w, base.name) : base.name,
    tile: base.tile,
    damage: base.damage,
    every: base.every,
    reach: base.reach,
    knock: base.knock,
    hands: base.hands,
    ...(brand ? { brand } : {}),
    options,
    special: isRandart,
  };
}
export function artefactAxe(w: World): AxeItem {
  const art = ARTEFACTS[Math.floor(w.rng() * ARTEFACTS.length)]!,
    base = axeBase(art.base);
  return {
    uid: uid(w, 'artefact'),
    baseId: base.id,
    name: art.name,
    tile: art.tile,
    damage: base.damage,
    every: base.every,
    reach: base.reach,
    knock: base.knock,
    hands: base.hands,
    brand: art.brand,
    options: [],
    effect: art.effect,
    special: true,
  };
}
function roomCell(w: World, roomIndex?: number): { x: number; y: number } | undefined {
  const pool = roomIndex === undefined ? (w.rooms.length > 1 ? w.rooms.slice(1) : w.rooms) : [w.rooms[roomIndex]!];
  for (let attempt = 0; attempt < 80; attempt++) {
    const room = pool[Math.floor(w.rng() * pool.length)];
    if (!room) return undefined;
    const x = room.x + 1 + Math.floor(w.rng() * Math.max(1, room.w - 2)),
      y = room.y + 1 + Math.floor(w.rng() * Math.max(1, room.h - 2));
    if (
      cellAt(w.grid, x, y) !== Cell.Floor ||
      w.stairs.some((s) => s.x === x && s.y === y) ||
      w.groundItems.some((item) => Math.floor(item.x) === x && Math.floor(item.y) === y)
    )
      continue;
    return { x: x + 0.5, y: y + 0.5 };
  }
  return undefined;
}
function putAxe(w: World, axe: AxeItem, cell: { x: number; y: number } | undefined): void {
  if (cell) w.groundItems.push({ uid: axe.uid, kind: 'axe', x: cell.x, y: cell.y, axe, ignored: false });
}
function putAmmo(w: World, count: number, cell: { x: number; y: number } | undefined): void {
  if (cell) w.groundItems.push({ uid: uid(w, 'ammo'), kind: 'ammo', x: cell.x, y: cell.y, count, ignored: false });
}
export function populateFloorItems(w: World): void {
  w.groundItems.length = 0;
  w.pendingPickup = null;
  const axes = rollInt(w, EQUIPMENT.axesMin, EQUIPMENT.axesMax);
  for (let i = 0; i < axes; i++) putAxe(w, generateAxe(w), roomCell(w));
  const piles = rollInt(w, EQUIPMENT.ammoPilesMin, EQUIPMENT.ammoPilesMax);
  for (let i = 0; i < piles; i++) putAmmo(w, rollInt(w, EQUIPMENT.ammoPileMin, EQUIPMENT.ammoPileMax), roomCell(w));
  if (!w.artefactPlaced && (w.depth === 3 || (w.depth === 2 && w.rng() < 0.5))) {
    let biggest = 0;
    for (let i = 1; i < w.rooms.length; i++) if (w.rooms[i]!.w * w.rooms[i]!.h > w.rooms[biggest]!.w * w.rooms[biggest]!.h) biggest = i;
    putAxe(w, artefactAxe(w), roomCell(w, biggest));
    w.artefactPlaced = true;
  }
}
export function weaponOption(weapon: AxeItem, id: string): number {
  return weapon.options.find((entry) => entry.id === id)?.value ?? 0;
}
export function weaponScore(weapon: AxeItem): number {
  return (
    (weapon.damage + weaponOption(weapon, 'damage')) / (weapon.every * (1 - weaponOption(weapon, 'haste'))) +
    (weapon.special ? 2 : 0) +
    (weapon.brand ? 0.8 : 0)
  );
}
export function resistanceFactor(level: number): number {
  if (level >= 3) return 0;
  if (level === -1) return 2;
  return Math.pow(0.5, Math.max(0, level));
}
const hpBonus = (weapon: AxeItem): number => weaponOption(weapon, 'maxHp');
export function acceptPickup(w: World): void {
  const item = w.pendingPickup;
  if (!item || item.kind !== 'axe' || !item.axe) return;
  const index = w.groundItems.indexOf(item);
  if (index < 0) return;
  const old = w.weapon,
    delta = hpBonus(item.axe) - hpBonus(old);
  w.hero.maxHp += delta;
  w.hero.hp = Math.min(w.hero.maxHp, Math.max(1, w.hero.hp + Math.max(0, delta)));
  w.weapon = item.axe;
  w.groundItems.splice(index, 1, { uid: old.uid, kind: 'axe', x: item.x, y: item.y, axe: old, ignored: true });
  w.pickupStats.swapped++;
  w.pendingPickup = null;
}
export function declinePickup(w: World): void {
  if (w.pendingPickup) w.pendingPickup.ignored = true;
  w.pendingPickup = null;
}
export function dropAmmo(w: World, x: number, y: number, count = 1): void {
  let cx = Math.floor(x),
    cy = Math.floor(y);
  if (!walkable(w.grid, cx, cy)) {
    outer: for (let r = 1; r <= 3; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (walkable(w.grid, cx + dx, cy + dy)) {
            cx += dx;
            cy += dy;
            break outer;
          }
  }
  const existing = w.groundItems.find((item) => item.kind === 'ammo' && Math.floor(item.x) === cx && Math.floor(item.y) === cy);
  if (existing) existing.count = (existing.count ?? 0) + count;
  else w.groundItems.push({ uid: uid(w, 'spent'), kind: 'ammo', x: cx + 0.5, y: cy + 0.5, count, ignored: false });
}
export function collectGround(w: World): void {
  for (const item of w.groundItems) {
    if (item.ignored && Math.hypot(item.x - w.hero.x, item.y - w.hero.y) > PICKUP_RELEASE_RADIUS) item.ignored = false;
  }
  for (let i = w.groundItems.length - 1; i >= 0; i--) {
    const item = w.groundItems[i]!;
    if (Math.hypot(item.x - w.hero.x, item.y - w.hero.y) > PICKUP_RADIUS) continue;
    if (item.kind === 'ammo') {
      const before = w.ammo;
      w.ammo = Math.min(EQUIPMENT.ammoMax, w.ammo + (item.count ?? 1));
      const took = w.ammo - before;
      if (took <= 0) continue;
      w.pickupStats.recovered += took;
      const left = (item.count ?? 1) - took;
      if (left > 0) item.count = left;
      else w.groundItems.splice(i, 1);
    } else if (!item.ignored && !w.pendingPickup) {
      w.pendingPickup = item;
      w.pickupStats.offered++;
    }
  }
}
