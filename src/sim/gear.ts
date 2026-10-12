import { itemDefinition, type ItemDefinition } from '../data/itemCatalog';
import type { World } from './types';
export type GearSlot = 'armour' | 'offhand' | 'helmet' | 'gloves' | 'boots' | 'cloak' | 'amulet' | 'ring1' | 'ring2';
export const GEAR_SLOTS: readonly GearSlot[] = ['armour', 'offhand', 'helmet', 'gloves', 'boots', 'cloak', 'amulet', 'ring1', 'ring2'];
export function hasShield(w: World): boolean {
  return w.weapon.hands === 1 && Boolean(w.gear.offhand && itemDefinition(w.gear.offhand).kind === 'shield');
}
export function offhandSchool(w: World): string | undefined {
  const item = w.gear.offhand ? itemDefinition(w.gear.offhand) : undefined;
  return item?.kind === 'spellbook' ? item.school : undefined;
}
export function stowOffhand(w: World): void {
  const current = w.gear.offhand;
  if (!current) return;
  delete w.gear.offhand;
  w.inventory.push({ uid: 'gear-' + w.nextItem++, kind: 'gear', id: current });
}
export function gearName(w: World, id: string): string {
  const level = w.gearEnchantment[id] ?? 0;
  return itemDefinition(id).name + (level ? ' +' + level : '') + (w.cursedGear.has(id) ? ' (저주)' : '');
}
export function gearSlot(item: ItemDefinition, w: World): GearSlot | undefined {
  if (item.kind === 'shield' || item.kind === 'spellbook') return 'offhand';
  if (item.kind === 'armour') {
    for (const slot of ['helmet', 'gloves', 'boots', 'cloak'] as const) if (item.id.includes(slot)) return slot;
    return 'armour';
  }
  if (item.kind !== 'jewellery') return undefined;
  if (item.id.includes('amulet')) return 'amulet';
  return !w.gear.ring1 ? 'ring1' : 'ring2';
}
export function equipGear(w: World, uid: string): boolean {
  if (w.over || w.choosing || w.rewardChoices || w.pendingPickup) return false;
  const index = w.inventory.findIndex((entry) => entry.kind === 'gear' && entry.uid === uid);
  const entry = w.inventory[index];
  if (!entry || entry.kind !== 'gear') return false;
  const slot = gearSlot(itemDefinition(entry.id), w);
  if (!slot || (slot === 'offhand' && w.weapon.hands === 2)) return false;
  const previous = w.gear[slot];
  if (previous && w.cursedGear.has(previous)) return false;
  w.gear[slot] = entry.id;
  w.inventory.splice(index, 1);
  if (previous) w.inventory.push({ uid: 'gear-' + w.nextItem++, kind: 'gear', id: previous });
  return true;
}
export function unequipGear(w: World, slot: GearSlot): boolean {
  const id = w.gear[slot];
  if (!id || w.cursedGear.has(id) || w.over || w.choosing || w.rewardChoices || w.pendingPickup) return false;
  delete w.gear[slot];
  w.inventory.push({ uid: 'gear-' + w.nextItem++, kind: 'gear', id });
  return true;
}
export function dropGear(w: World, uid: string): boolean {
  if (w.over || w.choosing || w.rewardChoices || w.pendingPickup) return false;
  const index = w.inventory.findIndex((entry) => entry.kind === 'gear' && entry.uid === uid);
  const entry = w.inventory[index];
  if (!entry || entry.kind !== 'gear') return false;
  w.inventory.splice(index, 1);
  w.groundItems.push({ uid: 'gear-' + w.nextItem++, kind: 'gear', itemId: entry.id, x: w.hero.x, y: w.hero.y, ignored: true });
  return true;
}
export function gearBonus(w: World, effect: string): number {
  return Object.values(w.gear).reduce((sum, id) => {
    if (!id) return sum;
    return (
      sum +
      itemDefinition(id)
        .effects.filter((e) => e.id === effect)
        .reduce((n, e) => n + (e.power ?? 0) + (effect === 'armour' ? (w.gearEnchantment[id] ?? 0) : 0), 0)
    );
  }, 0);
}
export function enchantArmour(w: World, id: string): boolean {
  if (!Object.values(w.gear).includes(id) || !['armour', 'shield'].includes(itemDefinition(id).kind)) return false;
  const level = w.gearEnchantment[id] ?? 0;
  if (level >= 9) return false;
  w.gearEnchantment[id] = level + 1;
  return true;
}
