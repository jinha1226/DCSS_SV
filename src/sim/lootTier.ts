import { DUNGEON } from '../data/packs';
import type { World } from './types';

/** Item quality follows the current dungeon node's difficulty, not its storage ID. */
export function lootTier(w: World): 0 | 1 | 2 {
  const difficulty = w.dungeonGraph.nodes.get(w.depth)?.difficulty;
  if (difficulty === undefined) throw new Error('Unknown dungeon node for loot tier: ' + w.depth);
  const [low, mid] = DUNGEON.lootTierDifficulty;
  return difficulty <= low ? 0 : difficulty <= mid ? 1 : 2;
}
