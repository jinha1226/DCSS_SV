import { ITEM_DEFINITIONS, type ItemDefinition } from '../data/itemCatalog';
import type { WeaponItem } from '../data/items';
import { DUNGEON } from '../data/packs';
import { generateMagicWeapon, generateWeapon } from './equipment';
import { lootTier } from './lootTier';
import type { ItemChoice, World } from './types';

const CARDS: readonly ItemChoice[] = [
  { id: 'weapon', kind: 'weapon', name: '무기', line: '현재 주손 계열의 무기' },
  { id: 'armour', kind: 'armour', name: '방어구', line: '몸·투구·장갑·장화·망토' },
  { id: 'jewellery', kind: 'jewellery', name: '장신구', line: '목걸이 또는 반지' },
  { id: 'offhand', kind: 'offhand', name: '보조손', line: '방패 또는 무작위 학파 마법서' },
];

function owned(w: World, id: string): boolean {
  return Object.values(w.gear).includes(id) || w.inventory.some((entry) => entry.kind === 'gear' && entry.id === id);
}

function weightedGear(w: World, accepts: (item: ItemDefinition) => boolean): ItemDefinition {
  const tier = lootTier(w);
  const all = ITEM_DEFINITIONS.filter((item) => item.enabled && accepts(item) && (item.depthWeights[tier] ?? 0) > 0);
  const fresh = all.filter((item) => !owned(w, item.id));
  const candidates = fresh.length ? fresh : all;
  const total = candidates.reduce((sum, item) => sum + (item.depthWeights[tier] ?? 0), 0);
  let roll = w.rng() * total;
  return candidates.find((item) => (roll -= item.depthWeights[tier] ?? 0) <= 0) ?? candidates[candidates.length - 1]!;
}

function acquireWeapon(w: World): WeaponItem {
  if (w.weapon.kind) return generateMagicWeapon(w, w.weapon.kind, w.weapon.school!);
  return generateWeapon(w, w.weapon.family, DUNGEON.acquireRandartChance);
}

function acquireGear(w: World, kind: ItemChoice['kind']): ItemDefinition {
  if (kind === 'armour') return weightedGear(w, (item) => item.kind === 'armour');
  if (kind === 'jewellery') return weightedGear(w, (item) => item.kind === 'jewellery');
  return weightedGear(w, (item) => item.kind === 'shield' || item.kind === 'spellbook');
}

/** Reveal category cards only when an acquire reward reaches the front of the queue. */
export function dealItemRewards(w: World): void {
  if (w.pendingRewards[0] !== 'acquire' || w.rewardChoices || w.choosing) return;
  w.rewardChoices = w.weapon.hands === 2 ? CARDS.filter((card) => card.kind !== 'offhand') : CARDS;
}

/** The chosen category creates exactly one seeded item and puts it in the bag. */
export function chooseReward(w: World, id: string): boolean {
  if (w.over || w.pendingRewards[0] !== 'acquire' || !w.rewardChoices) return false;
  const chosen = w.rewardChoices.find((card) => card.id === id);
  if (!chosen) return false;
  if (chosen.kind === 'weapon') {
    const weapon = acquireWeapon(w);
    w.inventory.push({ uid: weapon.uid, kind: 'weapon', weapon });
  } else {
    const item = acquireGear(w, chosen.kind);
    w.inventory.push({ uid: 'reward-' + w.nextItem++, kind: 'gear', id: item.id });
  }
  w.rewardChoices = null;
  w.pendingRewards.shift();
  dealItemRewards(w);
  return true;
}

/** Skip acquirement only; slot enhancement deliberately has no skip path. */
export function skipReward(w: World, kind: 'heal' | 'gold'): boolean {
  if (w.over || w.pendingRewards[0] !== 'acquire' || !w.rewardChoices) return false;
  if (kind === 'heal') {
    w.hero.hp = Math.min(w.hero.maxHp, w.hero.hp + Math.ceil(w.hero.maxHp * DUNGEON.rewardSkipHealFraction));
    w.hero.mana = Math.min(w.hero.maxMana, w.hero.mana + Math.ceil(w.hero.maxMana * DUNGEON.rewardSkipHealFraction));
  } else {
    const difficulty = w.dungeonGraph.nodes.get(w.depth)?.difficulty;
    if (difficulty === undefined) return false;
    w.gold += DUNGEON.rewardSkipGoldBase + DUNGEON.rewardSkipGoldPerDifficulty * difficulty;
  }
  w.rewardChoices = null;
  w.pendingRewards.shift();
  dealItemRewards(w);
  return true;
}
