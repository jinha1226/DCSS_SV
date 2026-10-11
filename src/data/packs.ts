import dungeonRaw from './json/dungeon.json';
import packsRaw from './json/packs.json';
import { monsterKind } from './monsters';
export interface PackKind {
  readonly id: string;
  readonly members: readonly { readonly kind: string; readonly min: number; readonly max: number }[];
  readonly floors: readonly [number, number];
  readonly weight: number;
}
export const DUNGEON = {
  floors: dungeonRaw.floors,
  tougher: dungeonRaw.tougher,
  loud: dungeonRaw.loud,
  descend: dungeonRaw.descend,
  calm: dungeonRaw.calm,
  bandEvery: dungeonRaw.bandEvery,
  bandSooner: dungeonRaw.bandSooner,
  bandLeast: dungeonRaw.bandLeast,
  most: dungeonRaw.most,
  levelXpBase: dungeonRaw.levelXpBase,
  levelXpStep: dungeonRaw.levelXpStep,
} as const;
export const PACKS: readonly PackKind[] = packsRaw.map((row) => {
  for (const member of row.members) monsterKind(member.kind);
  const floors: readonly [number, number] = [row.floors[0]!, row.floors[1]!];
  if (floors[0] < 1 || floors[1] > DUNGEON.floors || floors[0] > floors[1]) throw new Error(`packs.json: ${row.id}.floors: 잘못된 층 범위`);
  return { id: row.id, members: row.members, floors, weight: row.weight };
});
