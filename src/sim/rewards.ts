import { ITEM_DEFINITIONS } from '../data/itemCatalog';
import { DUNGEON } from '../data/packs';
import { generateWeapon, generateMagicWeapon } from './equipment';
import { lootTier } from './lootTier';
import { addConsumable } from './consumables';
import type { ItemChoice, World } from './types';

/** All cards grant existing inventory items, not new abilities or artefacts. */
const SUPPLIES = [
  'potion_healing',
  'potion_might',
  'potion_haste',
  'scroll_blink',
  'scroll_enchant_weapon',
  'scroll_enchant_armour',
  'potion_curing',
] as const;

function choose<T>(w: World, options: readonly T[]): T {
  return options[Math.floor(w.rng() * options.length)]!;
}

function gearCard(w: World): ItemChoice {
  const options = ITEM_DEFINITIONS.filter(
    (item) =>
      item.enabled &&
      ['armour', 'shield', 'jewellery', 'spellbook'].includes(item.kind) &&
      !(['shield', 'spellbook'].includes(item.kind) && w.weapon.hands === 2) &&
      (item.depthWeights[lootTier(w)] ?? 0) > 0 &&
      !Object.values(w.gear).includes(item.id) &&
      !w.inventory.some((owned) => owned.kind === 'gear' && owned.id === item.id),
  );
  const fallback = ITEM_DEFINITIONS.filter((item) => item.enabled && ['armour', 'jewellery'].includes(item.kind));
  const candidates = options.length ? options : fallback;
  const tier = lootTier(w);
  const total = candidates.reduce((sum, item) => sum + (item.depthWeights[tier] ?? 0), 0);
  let roll = w.rng() * total;
  const picked = candidates.find((item) => (roll -= item.depthWeights[tier] ?? 0) <= 0) ?? candidates[candidates.length - 1]!;
  return {
    id: 'gear:' + picked.id,
    kind: 'gear',
    name: picked.name,
    line: '방어구·장신구 · 가방에 보관',
    itemId: picked.id,
  };
}

function consumableCard(w: World): ItemChoice {
  const eligible = SUPPLIES.filter((id) => {
    if (id === 'scroll_enchant_weapon') return !w.weapon.special && (w.weapon.enchantment ?? 0) < 9;
    if (id === 'scroll_enchant_armour') return Boolean(w.gear.armour || w.gear.offhand);
    return true;
  });
  const itemId = choose(w, eligible);
  const item = ITEM_DEFINITIONS.find((entry) => entry.id === itemId)!;
  return { id: 'consumable:' + itemId, kind: 'consumable', name: item.name, line: '소모품 ×1 · 가방에 보관', itemId };
}

/** One seeded, fixed set per character level; rerendering does not reroll. */
export function dealItemRewards(w: World): void {
  if (w.pendingChoices <= 0 || w.rewardChoices || w.choosing) return;
  const weapon = generateRewardWeapon(w, w.weapon.family);
  w.rewardChoices = [
    { id: 'weapon:' + weapon.uid, kind: 'weapon', name: weapon.name, line: '무기 · 가방에 보관', weapon },
    gearCard(w),
    consumableCard(w),
  ];
}

/** A choice is granted once; future levels use a fresh set of cards. */
export function chooseReward(w: World, id: string): boolean {
  if (w.over || !w.rewardChoices) return false;
  const chosen = w.rewardChoices.find((card) => card.id === id);
  if (!chosen) return false;
  if (chosen.kind === 'weapon' && chosen.weapon) {
    w.inventory.push({ uid: chosen.weapon.uid, kind: 'weapon', weapon: chosen.weapon });
  } else if (chosen.kind === 'gear' && chosen.itemId) {
    w.inventory.push({ uid: 'reward-' + w.nextItem++, kind: 'gear', id: chosen.itemId });
  } else if (chosen.kind === 'consumable' && chosen.itemId) {
    addConsumable(w, chosen.itemId);
    w.identifiedItems.add(chosen.itemId);
  } else {
    return false;
  }
  w.rewardChoices = null;
  w.pendingChoices = Math.max(0, w.pendingChoices - 1);
  dealItemRewards(w);
  return true;
}

/** Skip the current item offer for a deterministic recovery or gold reward. */
export function skipReward(w: World, kind: 'heal' | 'gold'): boolean {
  if (w.over || !w.rewardChoices || (kind !== 'heal' && kind !== 'gold')) return false;
  if (kind === 'heal') {
    w.hero.hp = Math.min(w.hero.maxHp, w.hero.hp + Math.ceil(w.hero.maxHp * DUNGEON.rewardSkipHealFraction));
    w.hero.mana = Math.min(w.hero.maxMana, w.hero.mana + Math.ceil(w.hero.maxMana * DUNGEON.rewardSkipHealFraction));
  } else {
    const difficulty = w.dungeonGraph.nodes.get(w.depth)?.difficulty;
    if (difficulty === undefined) return false;
    w.gold += DUNGEON.rewardSkipGoldBase + DUNGEON.rewardSkipGoldPerDifficulty * difficulty;
  }
  w.rewardChoices = null;
  w.pendingChoices = Math.max(0, w.pendingChoices - 1);
  dealItemRewards(w);
  return true;
}
