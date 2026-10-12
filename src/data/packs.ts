import dungeonRaw from './json/dungeon.json';
import packsRaw from './json/packs.json';
import { monsterKind } from './monsters';
import type { Branch } from '../sim/dungeonGraph';
export interface PackKind {
  readonly id: string;
  readonly members: readonly { readonly kind: string; readonly min: number; readonly max: number }[];
  readonly floors: readonly [number, number];
  readonly weight: number;
  readonly branch?: Branch;
}
export const DUNGEON = {
  floors: dungeonRaw.floors,
  floorLimit: dungeonRaw.floorLimit,
  overdueBandEvery: dungeonRaw.overdueBandEvery,
  tougher: dungeonRaw.tougher,
  loud: dungeonRaw.loud,
  arrowLoud: dungeonRaw.arrowLoud,
  descend: dungeonRaw.descend,
  calm: dungeonRaw.calm,
  bandEvery: dungeonRaw.bandEvery,
  bandSooner: dungeonRaw.bandSooner,
  bandLeast: dungeonRaw.bandLeast,
  most: dungeonRaw.most,
  levelXpBase: dungeonRaw.levelXpBase,
  levelXpStep: dungeonRaw.levelXpStep,
  lootTierDifficulty: dungeonRaw.lootTierDifficulty,
  rewardSkipHealFraction: dungeonRaw.rewardSkipHealFraction,
  rewardSkipGoldBase: dungeonRaw.rewardSkipGoldBase,
  rewardSkipGoldPerDifficulty: dungeonRaw.rewardSkipGoldPerDifficulty,
} as const;
export const PACKS: readonly PackKind[] = packsRaw.map((row) => {
  for (const member of row.members) monsterKind(member.kind);
  const floors: readonly [number, number] = [row.floors[0]!, row.floors[1]!];
  if (floors[0] < 1 || floors[1] > ('branch' in row ? 3 : DUNGEON.floors) || floors[0] > floors[1])
    throw new Error(`packs.json: ${row.id}.floors: 잘못된 층 범위`);
  return { id: row.id, members: row.members, floors, weight: row.weight, ...('branch' in row ? { branch: row.branch as Branch } : {}) };
});
