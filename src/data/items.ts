import itemsRaw from './json/items.json';
import { hasTile, type TileName } from './tiles';

type Row = Record<string, unknown>;
const rows = itemsRaw as unknown as Row[];
const text = (row: Row, key: string): string => {
  const value = row[key];
  if (typeof value !== 'string') throw new Error('items.json: ' + String(row.id) + '.' + key + ': 문자열이 아님');
  return value;
};
const number = (row: Row, key: string): number => {
  const value = row[key];
  if (typeof value !== 'number') throw new Error('items.json: ' + String(row.id) + '.' + key + ': 숫자가 아님');
  return value;
};
const rowBy = (id: string): Row => {
  const row = rows.find((entry) => entry.id === id);
  if (!row) throw new Error('items.json: ' + id + ': 없는 항목');
  return row;
};
function tile(row: Row): TileName {
  const value = text(row, 'tile');
  if (!hasTile(value)) throw new Error('items.json: ' + String(row.id) + '.tile: 없는 타일 ' + value);
  return value as TileName;
}

export interface AxeBase {
  readonly id: string;
  readonly name: string;
  readonly tile: TileName;
  readonly class: string;
  readonly damage: number;
  readonly every: number;
  readonly reach: number;
  readonly knock: number;
  readonly hands: 1 | 2;
  readonly depthWeights: readonly number[];
}
export interface BrandData {
  readonly id: string;
  readonly name: string;
  readonly resist: ResistName;
  readonly colour: string;
  readonly duration?: number;
  readonly damage?: number;
  readonly slow?: number;
  readonly chainDamage?: number;
  readonly chainShare?: number;
  readonly heal?: number;
}
export type ResistName = 'fire' | 'cold' | 'electric' | 'negative' | 'poison';
export interface RandartOptionData {
  readonly id: string;
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}
export interface AxeOption {
  readonly id: string;
  readonly name: string;
  readonly value: number;
}
export interface AxeItem {
  readonly uid: string;
  readonly baseId: string;
  readonly name: string;
  readonly tile: TileName;
  readonly damage: number;
  readonly every: number;
  readonly reach: number;
  readonly knock: number;
  readonly hands: 1 | 2;
  readonly brand?: string;
  readonly options: readonly AxeOption[];
  readonly effect?: string;
  readonly special: boolean;
}
export interface ArtefactData {
  readonly id: string;
  readonly name: string;
  readonly base: string;
  readonly tile: TileName;
  readonly brand: string;
  readonly effect: string;
}
export interface EquipmentConfig {
  readonly axesMin: number;
  readonly axesMax: number;
  readonly ammoPilesMin: number;
  readonly ammoPilesMax: number;
  readonly ammoPileMin: number;
  readonly ammoPileMax: number;
  readonly ammoStart: number;
  readonly ammoMax: number;
}

export const AXES: readonly AxeBase[] = rows
  .filter((row) => row.kind === 'axe')
  .map((row) => {
    const hands = number(row, 'hands');
    const weights = row.depthWeights;
    if (hands !== 1 && hands !== 2) throw new Error('items.json: ' + String(row.id) + '.hands: 1 또는 2여야 함');
    if (!Array.isArray(weights) || weights.some((v) => typeof v !== 'number'))
      throw new Error('items.json: ' + String(row.id) + '.depthWeights: 숫자 배열이 아님');
    return {
      id: text(row, 'id'),
      name: text(row, 'name'),
      tile: tile(row),
      class: text(row, 'class'),
      damage: number(row, 'damage'),
      every: number(row, 'every'),
      reach: number(row, 'reach'),
      knock: number(row, 'knock'),
      hands,
      depthWeights: weights as number[],
    };
  });
export const BRANDS: readonly BrandData[] = rows
  .filter((row) => row.kind === 'brand')
  .map((row) => ({
    id: text(row, 'id'),
    name: text(row, 'name'),
    resist: text(row, 'resist') as ResistName,
    colour: text(row, 'colour'),
    ...(typeof row.duration === 'number' ? { duration: row.duration } : {}),
    ...(typeof row.damage === 'number' ? { damage: row.damage } : {}),
    ...(typeof row.slow === 'number' ? { slow: row.slow } : {}),
    ...(typeof row.chainDamage === 'number' ? { chainDamage: row.chainDamage } : {}),
    ...(typeof row.chainShare === 'number' ? { chainShare: row.chainShare } : {}),
    ...(typeof row.heal === 'number' ? { heal: row.heal } : {}),
  }));
export const RANDART_OPTIONS: readonly RandartOptionData[] = rows
  .filter((row) => row.kind === 'randartOption')
  .map((row) => {
    const min = number(row, 'min'),
      max = number(row, 'max'),
      step = number(row, 'step');
    if (min > max || step <= 0) throw new Error('items.json: ' + String(row.id) + ': 잘못된 옵션 범위');
    return { id: text(row, 'id'), name: text(row, 'name'), min, max, step };
  });
export const ARTEFACTS: readonly ArtefactData[] = rows
  .filter((row) => row.kind === 'artefact')
  .map((row) => ({
    id: text(row, 'id'),
    name: text(row, 'name'),
    base: text(row, 'base'),
    tile: tile(row),
    brand: text(row, 'brand'),
    effect: text(row, 'effect'),
  }));
export const ITEM_EFFECTS = new Set(['ember', 'glut']);
for (const art of ARTEFACTS) {
  if (!ITEM_EFFECTS.has(art.effect)) throw new Error('items.json: ' + art.id + '.effect: 코드에 없는 effect ' + art.effect);
  if (!AXES.some((axe) => axe.id === art.base)) throw new Error('items.json: ' + art.id + '.base: 없는 도끼 ' + art.base);
  if (!BRANDS.some((brand) => brand.id === art.brand)) throw new Error('items.json: ' + art.id + '.brand: 없는 속성 ' + art.brand);
}
const config = rowBy('equipment');
export const EQUIPMENT: EquipmentConfig = {
  axesMin: number(config, 'axesMin'),
  axesMax: number(config, 'axesMax'),
  ammoPilesMin: number(config, 'ammoPilesMin'),
  ammoPilesMax: number(config, 'ammoPilesMax'),
  ammoPileMin: number(config, 'ammoPileMin'),
  ammoPileMax: number(config, 'ammoPileMax'),
  ammoStart: number(config, 'ammoStart'),
  ammoMax: number(config, 'ammoMax'),
};
if (
  EQUIPMENT.axesMin > EQUIPMENT.axesMax ||
  EQUIPMENT.ammoPilesMin > EQUIPMENT.ammoPilesMax ||
  EQUIPMENT.ammoPileMin > EQUIPMENT.ammoPileMax
)
  throw new Error('items.json: equipment: 범위가 뒤집힘');
const names = rowBy('names');
export const NAME_PARTS = { prefixes: (names.prefixes as unknown[]).map(String), suffixes: (names.suffixes as unknown[]).map(String) };

export function axeBase(id: string): AxeBase {
  const axe = AXES.find((entry) => entry.id === id);
  if (!axe) throw new Error('items.json: ' + id + ': 없는 도끼');
  return axe;
}
export function brandData(id: string | undefined): BrandData | undefined {
  if (!id) return undefined;
  const brand = BRANDS.find((entry) => entry.id === id);
  if (!brand) throw new Error('items.json: ' + id + ': 없는 속성');
  return brand;
}
export function plainAxe(id: string, uid = id): AxeItem {
  const axe = axeBase(id);
  return {
    uid,
    baseId: axe.id,
    name: axe.name,
    tile: axe.tile,
    damage: axe.damage,
    every: axe.every,
    reach: axe.reach,
    knock: axe.knock,
    hands: axe.hands,
    options: [],
    special: false,
  };
}
export const THROW_DATA = (() => {
  const row = rowBy('boomerang');
  tile(row);
  return {
    damage: number(row, 'damage'),
    range: number(row, 'range'),
    speed: number(row, 'speed'),
    every: number(row, 'every'),
    knock: number(row, 'knock'),
  };
})();
export const ITEM_TILES = rows.filter((row) => typeof row.tile === 'string').map((row) => tile(row));
