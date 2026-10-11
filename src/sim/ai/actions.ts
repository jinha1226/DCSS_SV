import { spellData } from '../../data/spells';
import type { MonsterContext } from './context';

export type MonsterAction = 'melee' | 'ranged' | 'spell' | 'approach' | 'retreat' | 'hold';

export interface ActionCandidate {
  readonly action: MonsterAction;
  readonly spellId?: string;
}

/**
 * The monster's equipment and spells determine its available actions.
 * Nothing here selects an action or executes effects; impossibilities are
 * excluded before the utility calculation.
 */
export function availableMonsterActions(context: MonsterContext): ActionCandidate[] {
  const { monster: m, distance: d, reach, rangedRange, visible, ready, preferredRange } = context;
  const choices: ActionCandidate[] = [{ action: 'hold' }];
  if (visible && ready && d <= reach) choices.push({ action: 'melee' });
  if (visible && ready && rangedRange > 0 && d > reach && d <= rangedRange) {
    choices.push({ action: 'ranged' });
  }
  if (ready && m.spellCooldown <= 0) {
    for (const spellId of m.stats.ai?.spells ?? []) {
      const spell = spellData(spellId);
      if (m.mana < spell.mana) continue;
      if (spell.shape === 'utility') {
        if (spell.effect === 'guard' && m.guard <= 0 && m.hp < m.maxHp) choices.push({ action: 'spell', spellId });
        if (spell.effect === 'blink' && visible && d < 3) choices.push({ action: 'spell', spellId });
      } else if (
        visible &&
        d > 0 &&
        spell.range !== undefined &&
        d <= spell.range &&
        ['projectile', 'beam', 'burst', 'cloud'].includes(spell.shape)
      ) {
        choices.push({ action: 'spell', spellId });
      }
    }
  }
  // A ranged fighter chases only until inside range; a melee fighter closes
  // all the way. Pathfinding is left to the executor.
  if (!visible || d > (rangedRange || reach)) choices.push({ action: 'approach' });
  if (visible && preferredRange > 0 && d < preferredRange && d > reach) {
    choices.push({ action: 'retreat' });
  }
  return choices;
}
