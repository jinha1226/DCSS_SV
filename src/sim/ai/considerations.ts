import { spellData } from '../../data/spells';
import type { ActionCandidate } from './actions';
import type { MonsterContext } from './context';

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * A utility score represents expected tactical value (not a probability).
 * Combat values originate from items.json, monsters.json and spells.json.
 * Keep this deterministic so identical seeds produce identical decisions.
 */
export function scoreMonsterAction(context: MonsterContext, candidate: ActionCandidate): number {
  const { monster: m, distance: d, reach, rangedRange, preferredRange, hpRatio } = context;
  const ai = m.stats.ai;
  const danger = 1 - hpRatio;
  const weapon = m.weapon;
  if (candidate.action === 'melee') {
    const damage = weapon && weapon.family !== 'bow' ? weapon.damage : m.stats.damage;
    const urgency = clamp01(1 - d / Math.max(0.1, reach));
    return 55 + Math.min(24, damage * 1.3) + urgency * 5 + (ai?.aggression ?? 0);
  }
  if (candidate.action === 'ranged') {
    const damage = weapon?.family === 'bow' ? weapon.damage : m.stats.damage;
    const comfortable = preferredRange > 0 ? clamp01(d / preferredRange) : 1;
    return 55 + Math.min(24, damage * 1.4) + comfortable * 6 + (ai?.rangedBias ?? 0);
  }
  if (candidate.action === 'spell' && candidate.spellId) {
    const spell = spellData(candidate.spellId);
    if (spell.effect === 'guard') return 38 + danger * 75 + (ai?.spellBias ?? 0);
    if (spell.effect === 'blink') return 26 + danger * 65 + clamp01(1 - d / 3) * 15 + (ai?.spellBias ?? 0);
    const damage = spell.damage ?? 0;
    const manaPressure = spell.mana / Math.max(1, m.maxMana);
    const rangeComfort = clamp01((spell.range ?? 0) - d);
    return 53 + Math.min(31, damage * 1.8) + rangeComfort * 4 - manaPressure * 8 + (ai?.spellBias ?? 0);
  }
  if (candidate.action === 'retreat') {
    const tooClose = clamp01((preferredRange - d) / Math.max(1, preferredRange));
    // Retreat while reloading; an available shot generally outranks it.
    return 25 + tooClose * 28 + danger * 10 + (context.ready ? 0 : 10);
  }
  if (candidate.action === 'approach') {
    const range = rangedRange || reach;
    return 30 + clamp01((d - range) / Math.max(1, range)) * 15;
  }
  return 10; // Hold: a safe fallback rather than a high-priority command.
}
