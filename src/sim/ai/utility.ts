import { availableMonsterActions, type ActionCandidate } from './actions';
import { scoreMonsterAction } from './considerations';
import type { MonsterContext } from './context';

export interface ScoredAction extends ActionCandidate {
  readonly score: number;
}

/** All candidates are scored once from the same snapshot. */
export function rankMonsterActions(context: MonsterContext): ScoredAction[] {
  return availableMonsterActions(context)
    .map((candidate) => ({ ...candidate, score: scoreMonsterAction(context, candidate) }))
    .sort((left, right) => right.score - left.score);
}
