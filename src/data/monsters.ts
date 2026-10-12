import dungeonRaw from './json/dungeon.json';
import monstersRaw from './json/monsters.json';
import type { ResistName } from './items';
import { hasTile, type TileName } from './tiles';
import { spellData } from './spells';
import { itemDefinition } from './itemCatalog';
import { weaponBase } from './items';
import speciesRaw from './json/species.json';

export interface MonsterStats {
  readonly hp: number;
  readonly xp: number;
  readonly radius: number;
  readonly speed: number;
  readonly damage: number;
  readonly reach: number;
  readonly windup: number;
  readonly rest: number;
  readonly notice: number;
  readonly throws?: { readonly range: number; readonly keep: number; readonly speed: number; readonly item?: string };
  readonly weapon?: string;
  readonly mana?: number;
  readonly manaRegen?: number;
  /** References species.json for shared racial resistances and mana defaults. */
  readonly species?: string;
  /** Consumables from items.json, one use per listed entry. */
  readonly items?: readonly string[];
  /** Optional utility weights and shared spell IDs, configured in monsters.json. */
  readonly ai?: {
    readonly preferredRange?: number;
    readonly aggression?: number;
    readonly rangedBias?: number;
    readonly spellBias?: number;
    readonly spells?: readonly string[];
  };
  readonly flits?: number;
  readonly poison?: number;
  readonly constrict?: number;
  readonly waterNative?: boolean;
  readonly resists: Readonly<Partial<Record<ResistName, number>>>;
  readonly armour?: number;
  readonly elemental?: { readonly type: ResistName; readonly damage: number };
}
export interface MonsterKind {
  readonly id: string;
  readonly name: string;
  readonly tile: TileName;
  readonly role: string;
  readonly stats: MonsterStats;
}
export const MONSTERS: readonly MonsterKind[] = monstersRaw.map((row) => {
  if (!hasTile(row.tile)) throw new Error('monsters.json: ' + row.id + '.tile: 없는 타일 ' + row.tile);
  const resists = row.resists as Partial<Record<ResistName, number>>;
  for (const [name, level] of Object.entries(resists))
    if (!['fire', 'cold', 'electric', 'negative', 'poison'].includes(name) || typeof level !== 'number' || level < -1 || level > 3)
      throw new Error('monsters.json: ' + row.id + '.resists: 잘못된 저항');
  const rawElement: unknown = 'elemental' in row ? row.elemental : undefined;
  const armour: unknown = 'armour' in row ? row.armour : undefined;
  const element = rawElement as { type?: string; damage?: number } | undefined;
  if (
    element &&
    (!element.type ||
      !['fire', 'cold', 'electric', 'negative', 'poison'].includes(element.type) ||
      typeof element.damage !== 'number' ||
      !Number.isFinite(element.damage) ||
      element.damage < 0)
  ) {
    throw new Error('monsters.json: ' + row.id + '.elemental: 잘못된 속성 공격');
  }
  if ('armour' in row && (typeof row.armour !== 'number' || !Number.isFinite(row.armour) || row.armour < 0)) {
    throw new Error('monsters.json: ' + row.id + '.armour: 잘못된 방어력');
  }
  const ai = 'ai' in row ? (row.ai as MonsterStats['ai']) : undefined;
  const speciesId = 'species' in row ? row.species : undefined;
  const species = typeof speciesId === 'string' ? speciesRaw.find((entry) => entry.id === speciesId) : undefined;
  if (speciesId !== undefined && !species) throw new Error('monsters.json: ' + row.id + '.species: 없는 종족');
  const itemIds: unknown = 'items' in row ? row.items : undefined;
  if (itemIds !== undefined) {
    if (!Array.isArray(itemIds) || itemIds.some((id) => typeof id !== 'string'))
      throw new Error('monsters.json: ' + row.id + '.items: 문자열 배열이 아님');
    for (const id of itemIds) {
      const item = itemDefinition(id);
      if (!item.enabled || !['potion', 'scroll', 'wand'].includes(item.kind))
        throw new Error('monsters.json: ' + row.id + '.items: 사용할 수 없는 아이템');
    }
  }
  const weapon = 'weapon' in row ? row.weapon : undefined;
  if (weapon !== undefined) {
    if (typeof weapon !== 'string') throw new Error('monsters.json: ' + row.id + '.weapon: 문자열이 아님');
    weaponBase(weapon);
  }
  const resources = row as unknown as Record<string, unknown>;
  for (const key of ['mana', 'manaRegen'] as const) {
    const value = resources[key];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
      throw new Error('monsters.json: ' + row.id + '.' + key + ': 잘못된 마나 수치');
    }
  }
  if ('throws' in row && row.throws) {
    if (row.throws.item && itemDefinition(row.throws.item).kind !== 'missile') {
      throw new Error('monsters.json: ' + row.id + '.throws.item: 투사체가 아님');
    }
  }
  if (ai) {
    if (ai.preferredRange !== undefined && (!Number.isFinite(ai.preferredRange) || ai.preferredRange < 0))
      throw new Error('monsters.json: ' + row.id + '.ai.preferredRange');
    for (const id of ai.spells ?? []) {
      if (!spellData(id).enabled) throw new Error('monsters.json: ' + row.id + '.ai.spells: 꺼진 주문 ' + id);
    }
    for (const weight of [ai.aggression, ai.rangedBias, ai.spellBias]) {
      if (weight !== undefined && !Number.isFinite(weight)) throw new Error('monsters.json: ' + row.id + '.ai: 잘못된 가중치');
    }
  }
  const speciesResists = species && 'resists' in species ? (species.resists as Partial<Record<ResistName, number>>) : {};
  const combinedResists = { ...speciesResists, ...resists };
  const mana = typeof resources.mana === 'number' ? resources.mana : species?.mana;
  const manaRegen = typeof resources.manaRegen === 'number' ? resources.manaRegen : species?.manaRegen;
  const stats: MonsterStats = {
    hp: row.hp,
    xp: row.xp,
    radius: row.radius,
    speed: row.speed,
    damage: row.damage,
    reach: row.reach,
    windup: row.windup,
    rest: row.rest,
    notice: row.notice,
    resists: combinedResists,
    ...(typeof speciesId === 'string' ? { species: speciesId } : {}),
    ...(Array.isArray(itemIds) ? { items: itemIds as string[] } : {}),
    ...(typeof weapon === 'string' ? { weapon } : {}),
    ...(typeof mana === 'number' ? { mana } : {}),
    ...(typeof manaRegen === 'number' ? { manaRegen } : {}),
    ...(ai ? { ai } : {}),
    ...(typeof armour === 'number' ? { armour } : {}),
    ...(element ? { elemental: element as { type: ResistName; damage: number } } : {}),
    ...('throws' in row ? { throws: row.throws } : {}),
    ...('flits' in row ? { flits: row.flits } : {}),
    ...('poison' in row ? { poison: row.poison } : {}),
    ...('constrict' in row ? { constrict: row.constrict } : {}),
    ...('waterNative' in row ? { waterNative: row.waterNative } : {}),
  };
  return { id: row.id, name: row.name, tile: row.tile as TileName, role: row.role, stats };
});
export const POISON = dungeonRaw.poisonPerSecond;
export function monsterKind(id: string): MonsterKind {
  const kind = MONSTERS.find((m) => m.id === id);
  if (!kind) throw new Error('monsters.json: ' + id + ': 없는 몬스터');
  return kind;
}
