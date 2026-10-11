import { rankMonsterActions, type ScoredAction } from './utility';
import type { MonsterContext } from './context';

/**
 * Stable candidate order breaks equal-score ties. Selection has no side
 * effects; monster.ts is the lifecycle coordinator and executor.ts owns action
 * commitment and completion.
 */
export function selectMonsterAction(context: MonsterContext): ScoredAction {
  return rankMonsterActions(context)[0]!;
}
