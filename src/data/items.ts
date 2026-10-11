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

export type WeaponFamily = 'axe' | 'bow' | 'long_blade';

export interface WeaponBase {
  readonly id: string;
  readonly family: WeaponFamily;
  readonly name: string;
  readonly tile: TileName;
  readonly damage: number;
  readonly every: number;
  readonly range: number;
  readonly knock: number;
  readonly hands: 1 | 2;
  readonly projectileSpeed?: number;
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
export interface WeaponOption {
  readonly id: string;
  readonly name: string;
  readonly value: number;
}
export interface WeaponItem {
  readonly uid: string;
  readonly baseId: string;
  readonly family: WeaponFamily;
  readonly name: string;
  readonly tile: TileName;
  readonly damage: number;
  readonly every: number;
  readonly range: number;
  readonly knock: number;
  readonly hands: 1 | 2;
  readonly projectileSpeed?: number;
  readonly brand?: string;
  readonly options: readonly WeaponOption[];
  readonly effect?: string;
  readonly special: boolean;
  /** Persistent DCSS-style enchantment, separate from random artefact bonuses. */
  readonly enchantment?: number;
}
export type AxeItem = WeaponItem;
export type AxeOption = WeaponOption;

export interface ArtefactData {
  readonly id: string;
  readonly name: string;
  readonly base: string;
  readonly tile: TileName;
  readonly brand?: string;
  readonly effect: string;
}
export interface EquipmentConfig {
  readonly weaponsMin: number;
  readonly weaponsMax: number;
  readonly ammoPilesMin: number;
  readonly ammoPilesMax: number;
  readonly ammoPileMin: number;
  readonly ammoPileMax: number;
  readonly ammoMax: number;
}

export const WEAPONS: readonly WeaponBase[] = rows
  .filter((row) => row.kind === 'weapon')
  .map((row) => {
    const hands = number(row, 'hands');
    const family = text(row, 'family');
    const weights = row.depthWeights;
    if (family !== 'axe' && family !== 'bow' && family !== 'long_blade')
      throw new Error('items.json: ' + String(row.id) + '.family: 잘못된 계열');
    if (hands !== 1 && hands !== 2) throw new Error('items.json: ' + String(row.id) + '.hands: 1 또는 2여야 함');
    if (!Array.isArray(weights) || weights.some((v) => typeof v !== 'number')) {
      throw new Error('items.json: ' + String(row.id) + '.depthWeights: 숫자 배열이 아님');
    }
    return {
      id: text(row, 'id'),
      family,
      name: text(row, 'name'),
      tile: tile(row),
      damage: number(row, 'damage'),
      every: number(row, 'every'),
      range: number(row, 'range'),
      knock: number(row, 'knock'),
      hands,
      ...(typeof row.projectileSpeed === 'number' ? { projectileSpeed: row.projectileSpeed } : {}),
      depthWeights: weights as number[],
    };
  });

export const AXES = WEAPONS.filter((weapon) => weapon.family === 'axe');
export const BOWS = WEAPONS.filter((weapon) => weapon.family === 'bow');

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
    const min = number(row, 'min');
    const max = number(row, 'max');
    const step = number(row, 'step');
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
    ...(typeof row.brand === 'string' ? { brand: row.brand } : {}),
    effect: text(row, 'effect'),
  }));

export const ITEM_EFFECTS = new Set(['ember', 'glut', 'pierce_all']);
for (const art of ARTEFACTS) {
  if (!ITEM_EFFECTS.has(art.effect)) throw new Error('items.json: ' + art.id + '.effect: 코드에 없는 effect ' + art.effect);
  if (!WEAPONS.some((weapon) => weapon.id === art.base)) throw new Error('items.json: ' + art.id + '.base: 없는 무기 ' + art.base);
  if (art.brand && !BRANDS.some((brand) => brand.id === art.brand))
    throw new Error('items.json: ' + art.id + '.brand: 없는 속성 ' + art.brand);
}

const config = rowBy('equipment');
export const EQUIPMENT: EquipmentConfig = {
  weaponsMin: number(config, 'weaponsMin'),
  weaponsMax: number(config, 'weaponsMax'),
  ammoPilesMin: number(config, 'ammoPilesMin'),
  ammoPilesMax: number(config, 'ammoPilesMax'),
  ammoPileMin: number(config, 'ammoPileMin'),
  ammoPileMax: number(config, 'ammoPileMax'),
  ammoMax: number(config, 'ammoMax'),
};
if (
  EQUIPMENT.weaponsMin > EQUIPMENT.weaponsMax ||
  EQUIPMENT.ammoPilesMin > EQUIPMENT.ammoPilesMax ||
  EQUIPMENT.ammoPileMin > EQUIPMENT.ammoPileMax
) {
  throw new Error('items.json: equipment: 범위가 뒤집힘');
}

const names = rowBy('names');
export const NAME_PARTS = {
  prefixes: (names.prefixes as unknown[]).map(String),
  suffixes: (names.suffixes as unknown[]).map(String),
};

export function weaponBase(id: string): WeaponBase {
  const weapon = WEAPONS.find((entry) => entry.id === id);
  if (!weapon) throw new Error('items.json: ' + id + ': 없는 무기');
  return weapon;
}
export function axeBase(id: string): WeaponBase {
  const weapon = weaponBase(id);
  if (weapon.family !== 'axe') throw new Error('items.json: ' + id + ': 도끼가 아님');
  return weapon;
}
export function bowBase(id: string): WeaponBase {
  const weapon = weaponBase(id);
  if (weapon.family !== 'bow') throw new Error('items.json: ' + id + ': 활이 아님');
  return weapon;
}
export function brandData(id: string | undefined): BrandData | undefined {
  if (!id) return undefined;
  const brand = BRANDS.find((entry) => entry.id === id);
  if (!brand) throw new Error('items.json: ' + id + ': 없는 속성');
  return brand;
}
export function plainWeapon(id: string, uid = id): WeaponItem {
  const weapon = weaponBase(id);
  return {
    uid,
    baseId: weapon.id,
    family: weapon.family,
    name: weapon.name,
    tile: weapon.tile,
    damage: weapon.damage,
    every: weapon.every,
    range: weapon.range,
    knock: weapon.knock,
    hands: weapon.hands,
    ...(weapon.projectileSpeed ? { projectileSpeed: weapon.projectileSpeed } : {}),
    options: [],
    special: false,
  };
}
export function plainAxe(id: string, uid = id): WeaponItem {
  const weapon = plainWeapon(id, uid);
  if (weapon.family !== 'axe') throw new Error('items.json: ' + id + ': 도끼가 아님');
  return weapon;
}
export function plainBow(id: string, uid = id): WeaponItem {
  const weapon = plainWeapon(id, uid);
  if (weapon.family !== 'bow') throw new Error('items.json: ' + id + ': 활이 아님');
  return weapon;
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
