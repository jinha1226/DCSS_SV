import {
  ARTEFACTS,
  AXES,
  BOWS,
  WEAPONS,
  BRANDS,
  EQUIPMENT,
  NAME_PARTS,
  RANDART_OPTIONS,
  weaponBase,
  type WeaponFamily,
  type WeaponItem,
  type WeaponOption,
} from '../data/items';
import { Cell, cellAt, walkable } from './grid';
import { addConsumable, type ConsumableId } from './consumables';
import { ITEM_DEFINITIONS } from '../data/itemCatalog';
import { openSkill } from './skills';
import type { World } from './types';

const RANDART = [0.1, 0.3, 0.5] as const;
const BRAND = [0.12, 0.3, 0.5] as const;
const PICKUP_RADIUS = 0.55;
const PICKUP_RELEASE_RADIUS = 0.8;
const rollInt = (w: World, lo: number, hi: number): number => lo + Math.floor(w.rng() * (hi - lo + 1));
const uid = (w: World, prefix: string): string => prefix + '-' + w.depth + '-' + w.nextItem++;

function pool(family: WeaponFamily) {
  return family === 'axe' ? AXES : family === 'bow' ? BOWS : WEAPONS.filter((weapon) => weapon.family === 'long_blade');
}
function weighted(w: World, family: WeaponFamily) {
  const choices = pool(family),
    index = Math.max(0, Math.min(2, w.depth - 1));
  const total = choices.reduce((sum, weapon) => sum + (weapon.depthWeights[index] ?? 0), 0);
  let roll = w.rng() * total;
  for (const weapon of choices) {
    roll -= weapon.depthWeights[index] ?? 0;
    if (roll <= 0) return weapon;
  }
  return choices[0]!;
}
const randomBrand = (w: World): string => BRANDS[Math.floor(w.rng() * BRANDS.length)]!.id;
function option(w: World, row: (typeof RANDART_OPTIONS)[number]): WeaponOption {
  const steps = Math.round((row.max - row.min) / row.step);
  return { id: row.id, name: row.name, value: row.min + rollInt(w, 0, steps) * row.step };
}
function randomName(w: World, base: string): string {
  const a = NAME_PARTS.prefixes[Math.floor(w.rng() * NAME_PARTS.prefixes.length)] ?? '카르';
  const b = NAME_PARTS.suffixes[Math.floor(w.rng() * NAME_PARTS.suffixes.length)] ?? '둠';
  return a + b + '의 ' + base;
}
export function generateWeapon(w: World, family: WeaponFamily): WeaponItem {
  const base = weighted(w, family),
    index = Math.max(0, Math.min(2, w.depth - 1));
  const isRandart = w.rng() < RANDART[index]!;
  const brand = isRandart || w.rng() < BRAND[index]! ? randomBrand(w) : undefined;
  const options: WeaponOption[] = [];
  if (isRandart) {
    const choices = [...RANDART_OPTIONS],
      count = rollInt(w, 2, 3);
    while (options.length < count && choices.length) {
      const at = Math.floor(w.rng() * choices.length);
      options.push(option(w, choices.splice(at, 1)[0]!));
    }
  }
  return {
    uid: uid(w, family),
    baseId: base.id,
    family: base.family,
    name: isRandart ? randomName(w, base.name) : base.name,
    tile: base.tile,
    damage: base.damage,
    every: base.every,
    range: base.range,
    knock: base.knock,
    hands: base.hands,
    ...(base.projectileSpeed ? { projectileSpeed: base.projectileSpeed } : {}),
    ...(brand ? { brand } : {}),
    options,
    special: isRandart,
  };
}
export const generateAxe = (w: World): WeaponItem => generateWeapon(w, 'axe');
export const generateBow = (w: World): WeaponItem => generateWeapon(w, 'bow');

function artefactFor(w: World, family: WeaponFamily): WeaponItem {
  const choices = ARTEFACTS.filter((art) => weaponBase(art.base).family === family);
  const art = choices[Math.floor(w.rng() * choices.length)]!,
    base = weaponBase(art.base);
  return {
    uid: uid(w, 'artefact'),
    baseId: base.id,
    family: base.family,
    name: art.name,
    tile: art.tile,
    damage: base.damage,
    every: base.every,
    range: base.range,
    knock: base.knock,
    hands: base.hands,
    ...(base.projectileSpeed ? { projectileSpeed: base.projectileSpeed } : {}),
    ...(art.brand ? { brand: art.brand } : {}),
    options: [],
    effect: art.effect,
    special: true,
  };
}
export const artefactAxe = (w: World): WeaponItem => artefactFor(w, 'axe');
export const artefactBow = (w: World): WeaponItem => artefactFor(w, 'bow');

function roomCell(w: World, roomIndex?: number): { x: number; y: number } | undefined {
  const rooms = roomIndex === undefined ? (w.rooms.length > 1 ? w.rooms.slice(1) : w.rooms) : [w.rooms[roomIndex]!];
  for (let attempt = 0; attempt < 80; attempt++) {
    const room = rooms[Math.floor(w.rng() * rooms.length)];
    if (!room) return undefined;
    const x = room.x + 1 + Math.floor(w.rng() * Math.max(1, room.w - 2));
    const y = room.y + 1 + Math.floor(w.rng() * Math.max(1, room.h - 2));
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
function putWeapon(w: World, weapon: WeaponItem, cell: { x: number; y: number } | undefined, newPath = false): void {
  if (cell) w.groundItems.push({ uid: weapon.uid, kind: 'axe', x: cell.x, y: cell.y, axe: weapon, ignored: false, newPath });
}
function putAmmo(w: World, count: number, cell: { x: number; y: number } | undefined): void {
  if (cell) w.groundItems.push({ uid: uid(w, 'ammo'), kind: 'ammo', x: cell.x, y: cell.y, count, ignored: false });
}
function putBook(w: World, school: string, cell: { x: number; y: number } | undefined): void {
  if (!cell) return;
  w.groundItems.push({
    uid: uid(w, 'book'),
    kind: 'book',
    x: cell.x,
    y: cell.y,
    school,
    ignored: false,
    newPath: true,
  });
}
export function populateFloorItems(w: World): void {
  w.groundItems.length = 0;
  w.pendingPickup = null;
  const count = rollInt(w, EQUIPMENT.weaponsMin, EQUIPMENT.weaponsMax);
  const same = Math.ceil((count * 2) / 3),
    other: WeaponFamily = w.weapon.family === 'axe' ? 'bow' : 'axe';
  for (let i = 0; i < count; i++) {
    const family = i < same ? w.weapon.family : other;
    putWeapon(w, generateWeapon(w, family), roomCell(w), i === same);
  }
  if (w.itemsEnabled) {
    const available = ITEM_DEFINITIONS.filter((item) => item.enabled && ['potion', 'scroll', 'wand'].includes(item.kind));
    const tier = Math.min(2, w.depth - 1);
    const totalWeight = available.reduce((sum, item) => sum + (item.depthWeights[tier] ?? 0), 0);
    for (let i = 0; i < 3; i++) {
      const cell = roomCell(w);
      if (!cell) continue;
      let roll = w.rng() * totalWeight;
      let itemId: ConsumableId | undefined;
      for (const item of available) {
        roll -= item.depthWeights[tier] ?? 0;
        if (roll < 0) { itemId = item.id; break; }
      }
      if (!itemId) continue;
      w.groundItems.push({ uid: uid(w, 'supply'), kind: 'consumable', itemId, x: cell.x, y: cell.y, ignored: false });
    }
  }
  const piles = rollInt(w, EQUIPMENT.ammoPilesMin, EQUIPMENT.ammoPilesMax);
  for (let i = 0; i < piles; i++) putAmmo(w, rollInt(w, EQUIPMENT.ammoPileMin, EQUIPMENT.ammoPileMax), roomCell(w));
  if (w.heroDef.attackMode === 'magic' && !w.openSkills.has('fire')) putBook(w, 'fire', roomCell(w));
  if (!w.artefactPlaced && (w.depth === 3 || (w.depth === 2 && w.rng() < 0.5))) {
    let biggest = 0;
    for (let i = 1; i < w.rooms.length; i++) if (w.rooms[i]!.w * w.rooms[i]!.h > w.rooms[biggest]!.w * w.rooms[biggest]!.h) biggest = i;
    putWeapon(w, artefactFor(w, w.weapon.family), roomCell(w, biggest));
    w.artefactPlaced = true;
  }
}
export function weaponOption(weapon: WeaponItem, id: string): number {
  return weapon.options.find((entry) => entry.id === id)?.value ?? 0;
}
export function weaponScore(weapon: WeaponItem): number {
  return (
    (weapon.damage + (weapon.enchantment ?? 0) + weaponOption(weapon, 'damage')) / (weapon.every * (1 - weaponOption(weapon, 'haste'))) +
    (weapon.special ? 2 : 0) +
    (weapon.brand?.length ? 0.8 : 0)
  );
}
export { resistanceFactor } from './damage';
const hpBonus = (weapon: WeaponItem): number => weaponOption(weapon, 'maxHp');
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
  openSkill(w, w.weapon.family);
  w.groundItems.splice(index, 1, { uid: old.uid, kind: 'axe', x: item.x, y: item.y, axe: old, ignored: true });
  w.pickupStats.swapped++;
  w.pendingPickup = null;
}
/** Move a discovered weapon to the bag instead of replacing the equipped weapon. */
export function storePickup(w: World): void {
  const item = w.pendingPickup;
  if (!item || item.kind !== 'axe' || !item.axe) return;
  const index = w.groundItems.indexOf(item);
  if (index < 0) return;
  w.inventory.push({ uid: item.axe.uid, kind: 'weapon', weapon: item.axe });
  w.groundItems.splice(index, 1);
  w.pendingPickup = null;
}

/** Exchange the currently equipped weapon with a stored one. */
export function equipStoredWeapon(w: World, uid: string): boolean {
  const index = w.inventory.findIndex((item) => item.kind === 'weapon' && item.uid === uid);
  const entry = w.inventory[index];
  if (!entry || entry.kind !== 'weapon') return false;
  const old = w.weapon;
  const delta = hpBonus(entry.weapon) - hpBonus(old);
  w.hero.maxHp += delta;
  w.hero.hp = Math.min(w.hero.maxHp, Math.max(1, w.hero.hp + Math.max(0, delta)));
  w.weapon = entry.weapon;
  w.inventory[index] = { uid: old.uid, kind: 'weapon', weapon: old };
  openSkill(w, w.weapon.family);
  return true;
}

export function dropStoredWeapon(w: World, uid: string): boolean {
  const index = w.inventory.findIndex((item) => item.kind === 'weapon' && item.uid === uid);
  const entry = w.inventory[index];
  if (!entry || entry.kind !== 'weapon') return false;
  w.inventory.splice(index, 1);
  w.groundItems.push({
    uid: entry.uid,
    kind: 'axe',
    x: w.hero.x,
    y: w.hero.y,
    axe: entry.weapon,
    ignored: true,
  });
  return true;
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
  for (const item of w.groundItems)
    if (item.ignored && Math.hypot(item.x - w.hero.x, item.y - w.hero.y) > PICKUP_RELEASE_RADIUS) item.ignored = false;
  for (let i = w.groundItems.length - 1; i >= 0; i--) {
    const item = w.groundItems[i]!;
    if (Math.hypot(item.x - w.hero.x, item.y - w.hero.y) > PICKUP_RADIUS) continue;
    if (item.kind === 'path') {
      if (item.skill) openSkill(w, item.skill);
      w.groundItems.splice(i, 1);
    } else if (item.kind === 'book') {
      if (item.school) openSkill(w, item.school);
      w.groundItems.splice(i, 1);
    } else if (item.kind === 'consumable') {
      if (item.itemId) addConsumable(w, item.itemId as ConsumableId, item.count ?? 1);
      w.groundItems.splice(i, 1);
    } else if (item.kind === 'ammo') {
      const before = w.ammo;
      w.ammo = Math.min(EQUIPMENT.ammoMax, w.ammo + (item.count ?? 1));
      const took = w.ammo - before;
      if (took <= 0) continue;
      w.pickupStats.recovered += took;
      openSkill(w, 'throwing');
      const left = (item.count ?? 1) - took;
      if (left > 0) item.count = left;
      else w.groundItems.splice(i, 1);
    } else if (!item.ignored && !w.pendingPickup) {
      w.pendingPickup = item;
      w.pickupStats.offered++;
    }
  }
}
export interface NewPathOpener {
  readonly skill: string;
  readonly id: string;
}
export function placeNewPath(w: World, openers: readonly NewPathOpener[] = []): void {
  const available = openers.filter((opener) => !w.openSkills.has(opener.skill));
  if (!available.length) return;
  const opener = available[Math.floor(w.rng() * available.length)]!,
    room = w.rooms.length > 1 ? w.rooms[1 + Math.floor(w.rng() * (w.rooms.length - 1))]! : w.rooms[0];
  if (!room) return;
  for (let attempt = 0; attempt < 40; attempt++) {
    const x = room.x + 1 + Math.floor(w.rng() * Math.max(1, room.w - 2)),
      y = room.y + 1 + Math.floor(w.rng() * Math.max(1, room.h - 2));
    if (cellAt(w.grid, x, y) !== Cell.Floor || w.groundItems.some((item) => Math.floor(item.x) === x && Math.floor(item.y) === y)) continue;
    w.groundItems.push({
      uid: 'path-' + opener.id + '-' + w.depth,
      kind: 'path',
      x: x + 0.5,
      y: y + 0.5,
      skill: opener.skill,
      ignored: false,
      newPath: true,
    });
    return;
  }
}
