import slotsRaw from '../data/json/slots.json';
import type { ResistName } from '../data/items';
import { offhandSchool } from './gear';
import { dealItemRewards } from './rewards';
import type { World } from './types';

export const SLOT_IDS = ['weapon', 'offhand', 'body', 'helmet', 'gloves', 'boots', 'cloak', 'amulet', 'ring1', 'ring2'] as const;
export type SlotId = (typeof SLOT_IDS)[number];
export type RingSlotId = 'ring1' | 'ring2';
export type SlotEffect = 'weapon' | 'offhand' | 'armour' | 'max_hp' | 'attack_speed' | 'move_speed' | 'dodge' | 'max_mana' | 'resist';
export type SlotBonusEffect =
  'weapon_damage' | 'magic_power' | 'armour' | 'block' | 'attack_speed' | 'move_speed' | 'dodge' | 'max_hp' | 'max_mana' | ResistName;

export interface SlotData {
  readonly id: SlotId;
  readonly name: string;
  readonly effect: SlotEffect;
  readonly perLevel: number;
  readonly cap: number;
}

const EFFECTS = new Set<SlotEffect>(['weapon', 'offhand', 'armour', 'max_hp', 'attack_speed', 'move_speed', 'dodge', 'max_mana', 'resist']);
const ids = new Set<string>();
export const SLOTS: readonly SlotData[] = slotsRaw.map((row) => {
  if (!SLOT_IDS.includes(row.id as SlotId) || ids.has(row.id)) throw new Error('slots.json: 중복 또는 잘못된 id ' + row.id);
  if (!EFFECTS.has(row.effect as SlotEffect)) throw new Error('slots.json: 알 수 없는 effect ' + row.effect);
  if (!Number.isInteger(row.cap) || row.cap < 1) throw new Error('slots.json: cap은 1 이상이어야 함 ' + row.id);
  if (typeof row.perLevel !== 'number' || !Number.isFinite(row.perLevel)) throw new Error('slots.json: 잘못된 perLevel ' + row.id);
  ids.add(row.id);
  return row as SlotData;
});
if (ids.size !== SLOT_IDS.length) throw new Error('slots.json: 모든 부위가 필요함');

export const slotData = (id: SlotId): SlotData => SLOTS.find((slot) => slot.id === id)!;
export const emptySlotLevels = (): Record<SlotId, number> => Object.fromEntries(SLOT_IDS.map((id) => [id, 0])) as Record<SlotId, number>;

/** Return only permanent slot enhancement; equipped-item bonuses stay in their existing systems. */
export function slotBonus(w: World, effect: SlotBonusEffect, school?: string): number {
  const value = (id: SlotId): number => w.hero.slotLevels[id] * slotData(id).perLevel;
  if (effect === 'weapon_damage') return w.weapon.kind ? 0 : value('weapon');
  if (effect === 'magic_power') {
    const weapon = w.weapon.kind && w.weapon.school === school ? value('weapon') : 0;
    const book = offhandSchool(w) === school ? value('offhand') : 0;
    return weapon + book;
  }
  if (effect === 'armour') return value('body');
  if (effect === 'block') return offhandSchool(w) ? 0 : value('offhand') * 0.02;
  if (effect === 'attack_speed') return value('gloves');
  if (effect === 'move_speed') return value('boots');
  if (effect === 'dodge') return value('cloak');
  if (effect === 'max_hp') return value('helmet');
  if (effect === 'max_mana') return value('amulet');
  let total = 0;
  for (const id of ['ring1', 'ring2'] as const) if (w.hero.ringResist[id] === effect) total += value(id);
  return total;
}

export function upgradeSlot(w: World, id: SlotId, resist?: ResistName): boolean {
  if (w.over || w.pendingRewards[0] !== 'slot') return false;
  const data = slotData(id);
  const level = w.hero.slotLevels[id];
  if (level >= data.cap) return false;
  if ((id === 'ring1' || id === 'ring2') && level === 0) {
    if (!resist) return false;
    w.hero.ringResist[id] = resist;
  }
  w.hero.slotLevels[id] = level + 1;
  if (data.effect === 'max_hp') {
    w.hero.maxHp += data.perLevel;
    w.hero.hp += data.perLevel;
  } else if (data.effect === 'max_mana') {
    w.hero.maxMana += data.perLevel;
    w.hero.mana += data.perLevel;
  }
  w.pendingRewards.shift();
  dealItemRewards(w);
  return true;
}
