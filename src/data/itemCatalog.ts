import rawItems from './json/items.json';
import { hasTile } from './tiles';

export const ITEM_KINDS = [
  'weapon',
  'throw',
  'missile',
  'book',
  'potion',
  'scroll',
  'wand',
  'jewellery',
  'armour',
  'shield',
  'misc',
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];
export type ItemUseMode = 'equip' | 'store' | 'choose' | 'on_step' | 'learn' | 'automatic';

export interface ItemEffect {
  readonly id: string;
  readonly power?: number;
  readonly duration?: number;
  readonly radius?: number;
}

export interface ItemDefinition {
  readonly id: string;
  readonly kind: ItemKind;
  readonly name: string;
  readonly enabled: boolean;
  readonly tile?: string;
  readonly useMode: ItemUseMode;
  readonly stackable: boolean;
  readonly maxStack: number;
  readonly depthWeights: readonly number[];
  readonly effects: readonly ItemEffect[];
}

type Row = Record<string, unknown>;
const hasOwn = (row: Row, key: string): boolean => Object.prototype.hasOwnProperty.call(row, key);
const isKind = (value: unknown): value is ItemKind => ITEM_KINDS.some((kind) => kind === value);

export function parseItemDefinition(row: Row): ItemDefinition {
  const id = row.id;
  const label = 'items.json: ' + String(id);
  if (typeof id !== 'string' || !id) throw new Error(label + ': id가 필요함');
  if (!isKind(row.kind)) throw new Error(label + ': 알 수 없는 아이템 종류');
  if (typeof row.name !== 'string' || !row.name) throw new Error(label + ': 이름이 필요함');

  const enabled = row.enabled === undefined ? true : row.enabled;
  if (typeof enabled !== 'boolean') throw new Error(label + ': enabled는 불리언이어야 함');
  if (row.tile !== undefined && (typeof row.tile !== 'string' || !hasTile(row.tile))) {
    throw new Error(label + ': 없는 타일');
  }
  if (enabled && !row.tile) throw new Error(label + ': 활성 아이템은 타일이 필요함');

  const defaults: Record<ItemKind, ItemUseMode> = {
    weapon: 'equip',
    throw: 'automatic',
    missile: 'automatic',
    book: 'learn',
    potion: 'store',
    scroll: 'store',
    wand: 'store',
    jewellery: 'equip',
    armour: 'equip',
    shield: 'equip',
    misc: 'choose',
  };
  const useMode = row.useMode ?? defaults[row.kind];
  if (!['equip', 'store', 'choose', 'on_step', 'learn', 'automatic'].includes(String(useMode))) {
    throw new Error(label + ': 알 수 없는 사용 방식');
  }
  const stackable = row.stackable ?? ['potion', 'scroll', 'missile'].includes(row.kind);
  if (typeof stackable !== 'boolean') throw new Error(label + ': stackable은 불리언이어야 함');
  const maxStack = row.maxStack ?? (stackable ? 9 : 1);
  if (typeof maxStack !== 'number' || !Number.isInteger(maxStack) || maxStack < 1 || (!stackable && maxStack !== 1)) {
    throw new Error(label + ': 잘못된 최대 중첩');
  }
  const depthWeights = row.depthWeights ?? [0, 0, 0];
  if (
    !Array.isArray(depthWeights) ||
    depthWeights.length !== 3 ||
    depthWeights.some((weight: unknown) => typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0)
  ) {
    throw new Error(label + ': depthWeights는 3개의 음이 아닌 숫자여야 함');
  }
  if (!enabled && depthWeights.some((weight: number) => weight !== 0)) {
    throw new Error(label + ': 미구현 아이템은 드롭 가중치를 0으로 유지해야 함');
  }

  const effects = row.effects ?? [];
  if (!Array.isArray(effects)) throw new Error(label + ': effects는 배열이어야 함');
  for (const effect of effects) {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) throw new Error(label + ': 잘못된 effect');
    const params = effect as Row;
    if (typeof params.id !== 'string' || !params.id) throw new Error(label + ': effect id가 필요함');
    for (const key of ['power', 'duration', 'radius']) {
      if (hasOwn(params, key) && (typeof params[key] !== 'number' || !Number.isFinite(params[key]))) {
        throw new Error(label + ': 잘못된 effect ' + key);
      }
    }
  }
  // Only consumable effects with implemented handlers may be activated.
  const supported = new Set([
    'heal',
    'blink',
    'lightning',
    'restore_mana',
    'might',
    'haste',
    'cure',
    'poison',
    'enchant_weapon',
    'identify',
    'teleport',
    'fear',
    'armour',
    'shield',
    'fire_resist',
    'cold_resist',
    'enchant_armour',
    'remove_curse',
    'confusion',
  ]);
  if (enabled && effects.some((effect) => !supported.has((effect as ItemEffect).id))) {
    throw new Error(label + ': effects 실행기는 아직 연결되지 않음');
  }

  return {
    id,
    kind: row.kind,
    name: row.name,
    enabled,
    ...(typeof row.tile === 'string' ? { tile: row.tile } : {}),
    useMode: useMode as ItemUseMode,
    stackable,
    maxStack,
    depthWeights: depthWeights as number[],
    effects: effects as ItemEffect[],
  };
}

const gameRows = (rawItems as unknown as Row[]).filter((row) => isKind(row.kind));
export const ITEM_DEFINITIONS: readonly ItemDefinition[] = gameRows.map(parseItemDefinition);

export function itemDefinition(id: string): ItemDefinition {
  const item = ITEM_DEFINITIONS.find((entry) => entry.id === id);
  if (!item) throw new Error('items.json: ' + id + ': 없는 아이템 정의');
  return item;
}

export function validateItemDefinitions(): void {
  const ids = new Set<string>();
  for (const row of rawItems as unknown as Row[]) {
    if (typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw new Error('items.json: 중복 또는 잘못된 id');
    ids.add(row.id);
  }
}
