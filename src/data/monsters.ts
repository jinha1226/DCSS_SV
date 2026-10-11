import dungeonRaw from './json/dungeon.json';
import monstersRaw from './json/monsters.json';
import type { ResistName } from './items';
import { hasTile, type TileName } from './tiles';

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
  readonly throws?: { readonly range: number; readonly keep: number; readonly speed: number };
  readonly flits?: number;
  readonly poison?: number;
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
    resists,
    ...(typeof row.armour === 'number' ? { armour: row.armour } : {}),
    ...(element ? { elemental: element as { type: ResistName; damage: number } } : {}),
    ...('throws' in row ? { throws: row.throws } : {}),
    ...('flits' in row ? { flits: row.flits } : {}),
    ...('poison' in row ? { poison: row.poison } : {}),
  };
  return { id: row.id, name: row.name, tile: row.tile as TileName, role: row.role, stats };
});
export const POISON = dungeonRaw.poisonPerSecond;
export function monsterKind(id: string): MonsterKind {
  const kind = MONSTERS.find((m) => m.id === id);
  if (!kind) throw new Error('monsters.json: ' + id + ': 없는 몬스터');
  return kind;
}
