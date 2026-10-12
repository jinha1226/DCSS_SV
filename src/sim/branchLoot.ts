import { ITEM_DEFINITIONS } from '../data/itemCatalog';
import { generateWeapon } from './equipment';
import { Cell, cellAt } from './grid';
import type { World, ShopOffer } from './types';

function freeCell(w: World, roomIndex: number): { x: number; y: number } | undefined {
  const room = w.rooms[roomIndex];
  if (!room) return undefined;
  const cells: { x: number; y: number }[] = [];
  for (let y = room.y + 1; y < room.y + room.h - 1; y++)
    for (let x = room.x + 1; x < room.x + room.w - 1; x++)
      if (
        cellAt(w.grid, x, y) === Cell.Floor &&
        !w.stairs.some((stair) => stair.x === x && stair.y === y) &&
        !w.groundItems.some((item) => Math.floor(item.x) === x && Math.floor(item.y) === y)
      )
        cells.push({ x: x + 0.5, y: y + 0.5 });
  return cells.length ? cells[Math.floor(w.rng() * cells.length)] : undefined;
}

function cache(w: World, kind: 'gold' | 'gear' | 'axe', room: number, itemId?: string): void {
  const cell = freeCell(w, room);
  if (!cell) return;
  const uid = 'branch-' + w.depth + '-' + w.nextItem++;
  if (kind === 'gold') {
    w.groundItems.push({ uid, kind, ...cell, count: 25 + Math.floor(w.rng() * 26), ignored: false });
  } else if (kind === 'gear' && itemId) {
    w.groundItems.push({ uid, kind, ...cell, itemId, ignored: false });
  } else if (kind === 'axe') {
    const weapon = generateWeapon(w, w.weapon.family);
    weapon.enchantment = Math.max(weapon.enchantment ?? 0, 1 + Math.floor(w.rng() * 3));
    w.groundItems.push({ uid, kind, ...cell, axe: weapon, ignored: false });
  }
}

/** Called exactly once for a newly generated floor; never on a restored floor. */
export function populateBranchLoot(w: World): void {
  if (!w.itemsEnabled) return;
  const node = w.dungeonGraph.nodes.get(w.depth);
  if (!node) return;
  if (node.branch === 'Orc') {
    for (let i = 0; i < 2; i++) cache(w, 'gold', Math.min(w.rooms.length - 1, i + 1));
    if (node.floor === 3 && !w.shopStock.length) {
      for (let i = 0; i < 2; i++) {
        const weapon = generateWeapon(w, i === 0 ? w.weapon.family : w.weapon.family === 'axe' ? 'bow' : 'axe');
        weapon.enchantment = Math.max(weapon.enchantment ?? 0, 2);
        w.shopStock.push({ uid: 'shop-' + i, price: 65 + i * 30, weapon });
      }
      const gear = ITEM_DEFINITIONS.filter((item) => item.enabled && ['armour', 'shield', 'jewellery'].includes(item.kind));
      const chosen = gear[Math.floor(w.rng() * gear.length)];
      if (chosen) w.shopStock.push({ uid: 'shop-gear', price: 55, itemId: chosen.id });
    }
  } else if (node.branch === 'Vaults') {
    cache(w, 'axe', Math.min(w.rooms.length - 1, 1));
    const gear = ITEM_DEFINITIONS.filter((item) => item.enabled && ['armour', 'shield', 'jewellery'].includes(item.kind));
    const chosen = gear[Math.floor(w.rng() * gear.length)];
    if (chosen) cache(w, 'gear', Math.min(w.rooms.length - 1, 2), chosen.id);
  }
}

/** The Orc:3 merchant stays at a fixed, discoverable room centre. */
export function shopLocation(w: World): { x: number; y: number } | undefined {
  if (w.dungeonGraph.nodes.get(w.depth)?.branch !== 'Orc' || w.dungeonGraph.nodes.get(w.depth)?.floor !== 3) return undefined;
  const room = w.rooms[0];
  if (!room) return undefined;
  // Shop access is intentionally adjacent to the arrival stair, without a new collision tile.
  const up = w.stairs.find((stair) => !stair.down);
  return up ? { x: up.x + 0.5, y: up.y + 0.5 } : { x: room.x + 1.5, y: room.y + 1.5 };
}
export function shopAccessible(w: World): boolean {
  const spot = shopLocation(w);
  return !!spot && Math.hypot(w.hero.x - spot.x, w.hero.y - spot.y) <= 1.8 && !w.over && !w.choosing && !w.pendingPickup;
}
export function buyOffer(w: World, uid: string): boolean {
  if (!shopAccessible(w)) return false;
  const index = w.shopStock.findIndex((offer) => offer.uid === uid);
  const offer: ShopOffer | undefined = w.shopStock[index];
  if (!offer || w.gold < offer.price) return false;
  w.gold -= offer.price;
  if (offer.weapon) w.inventory.push({ uid: offer.weapon.uid, kind: 'weapon', weapon: offer.weapon });
  else if (offer.itemId) w.inventory.push({ uid: 'shop-gear-' + w.nextItem++, kind: 'gear', id: offer.itemId });
  w.shopStock.splice(index, 1);
  return true;
}
