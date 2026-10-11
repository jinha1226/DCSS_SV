import type { World } from './types';
import { activateItem } from './itemEffects';
import { ITEM_DEFINITIONS } from '../data/itemCatalog';
import { identifyItem } from './identification';

export type ConsumableId = string;
export const CONSUMABLES: Readonly<Record<string, { name: string; action: string }>> = Object.fromEntries(
  ITEM_DEFINITIONS.filter((item) => item.enabled && ['potion', 'scroll', 'wand'].includes(item.kind)).map((item) => [
    item.id,
    { name: item.name, action: item.kind === 'potion' ? '마시기' : item.kind === 'scroll' ? '읽기' : '사용' },
  ]),
);
export const consumableName = (id: string): string => CONSUMABLES[id]?.name ?? id;

export function addConsumable(w: World, id: ConsumableId, count = 1): void {
  const entry = w.inventory.find((item) => item.kind === 'consumable' && item.id === id);
  if (entry?.kind === 'consumable') entry.count += count;
  else w.inventory.push({ uid: id, kind: 'consumable', id, count });
}

/** Uses one item only when its effect can actually be applied. */
/** Drop one unit from a stack at the hero's feet. */
export function dropConsumable(w: World, id: ConsumableId): boolean {
  if (w.over || w.pendingPickup || w.choosing) return false;
  const index = w.inventory.findIndex((entry) => entry.kind === 'consumable' && entry.id === id);
  const entry = w.inventory[index];
  if (!entry || entry.kind !== 'consumable' || entry.count <= 0) return false;
  entry.count--;
  if (entry.count === 0) w.inventory.splice(index, 1);
  w.groundItems.push({
    uid: 'dropped-' + w.nextItem++,
    kind: 'consumable',
    itemId: id,
    count: 1,
    x: w.hero.x,
    y: w.hero.y,
    ignored: true,
  });
  return true;
}

export function useConsumable(w: World, id: ConsumableId, targetId?: string): boolean {
  if (w.over || w.choosing || w.pendingPickup) return false;
  const index = w.inventory.findIndex((item) => item.kind === 'consumable' && item.id === id);
  const item = w.inventory[index];
  if (!item || item.kind !== 'consumable' || item.count <= 0) return false;
  // Shared item effect handler is also used by monster utility AI.
  if (id === 'scroll_identify' && targetId) {
    const target = w.inventory.find((entry) => entry.kind === 'consumable' && entry.id === targetId);
    if (!target || w.identifiedItems.has(targetId) || targetId === id) return false;
    identifyItem(w, targetId);
    item.count--;
    if (item.count === 0) w.inventory.splice(index, 1);
    identifyItem(w, id);
    return true;
  }
  if (!activateItem(w, id, 'hero')) return false;
  item.count--;
  if (item.count === 0) w.inventory.splice(index, 1);
  identifyItem(w, id);
  return true;
}
