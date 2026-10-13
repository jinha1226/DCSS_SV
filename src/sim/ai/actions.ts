import { monsterSpellMana, spellData } from '../../data/spells';
import { itemDefinition } from '../../data/itemCatalog';
import { LIGHTNING_RANGE } from '../itemEffects';
import { DUNGEON } from '../../data/packs';
import type { MonsterContext } from './context';

export type MonsterAction = 'melee' | 'ranged' | 'spell' | 'item' | 'approach' | 'retreat' | 'hold';

export interface ActionCandidate {
  readonly action: MonsterAction;
  readonly spellId?: string;
  readonly itemId?: string;
}

/**
 * The monster's equipment and spells determine its available actions.
 * Nothing here selects an action or executes effects; impossibilities are
 * excluded before the utility calculation.
 */
export function availableMonsterActions(context: MonsterContext): ActionCandidate[] {
  const { monster: m, distance: d, reach, rangedRange, effectiveRange, visible, ready, preferredRange } = context;
  const choices: ActionCandidate[] = [{ action: 'hold' }];
  if (visible && ready && d <= reach && m.contact >= DUNGEON.melee.firstContact) choices.push({ action: 'melee' });
  if (visible && ready && rangedRange > 0 && d > reach && d <= rangedRange) {
    choices.push({ action: 'ranged' });
  }
  if (ready && m.spellCooldown <= 0) {
    for (const spellId of m.stats.ai?.spells ?? []) {
      const spell = spellData(spellId);
      if (m.mana < monsterSpellMana(spell)) continue;
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
  if (ready) {
    for (const [itemId, uses] of Object.entries(m.itemUses)) {
      if (uses <= 0) continue;
      const effect = itemDefinition(itemId).effects[0];
      if (!effect) continue;
      if (effect.id === 'heal' && m.hp < m.maxHp) choices.push({ action: 'item', itemId });
      if (effect.id === 'restore_mana' && m.mana < m.maxMana) choices.push({ action: 'item', itemId });
      if (effect.id === 'blink' && visible && d < 3) choices.push({ action: 'item', itemId });
      if (effect.id === 'lightning' && visible && d <= LIGHTNING_RANGE) choices.push({ action: 'item', itemId });
    }
  }
  // A ranged fighter chases only until inside range; a melee fighter closes
  // all the way. Pathfinding is left to the executor.
  if (!visible || d > (effectiveRange || reach)) choices.push({ action: 'approach' });
  if (visible && preferredRange > 0 && d < preferredRange && d > reach) {
    choices.push({ action: 'retreat' });
  }
  return choices;
}
