import { describe, expect, it } from 'vitest';
import { plainAxe } from '../../src/data/items';
import { dealItemRewards, chooseReward, skipReward } from '../../src/sim/rewards';
import { makeWorld, stepWorld } from '../../src/sim/world';

function acquire(seed: number, species = 'minotaur', job = 'berserker') {
  const w = makeWorld({ seed, species, job, monsters: false, items: false });
  w.pendingRewards.push('acquire');
  dealItemRewards(w);
  return w;
}

describe('scheduled acquirement rewards', () => {
  it('offers four categories, then stores a current-family weapon without equipping it', () => {
    const w = acquire(201);
    expect(w.rewardChoices?.map((card) => card.kind)).toEqual(['weapon', 'armour', 'jewellery', 'offhand']);
    const original = w.weapon;
    expect(chooseReward(w, 'weapon')).toBe(true);
    const found = w.inventory.find((entry) => entry.kind === 'weapon');
    expect(found?.kind === 'weapon' && found.weapon.family).toBe(original.family);
    expect(w.weapon).toBe(original);
    expect(chooseReward(w, 'weapon')).toBe(false);
  });

  it('omits offhand for a two-handed main weapon', () => {
    const w = acquire(202);
    w.weapon = plainAxe('battle_axe', 'two-handed');
    w.rewardChoices = null;
    dealItemRewards(w);
    const choices = w.rewardChoices as readonly { readonly kind: string }[] | null;
    expect(choices?.map((card) => card.kind)).toEqual(['weapon', 'armour', 'jewellery']);
  });

  it('uses the configured high randart chance for physical weapons', () => {
    const rolls = Array.from({ length: 100 }, (_, i) => {
      const w = acquire(300 + i);
      chooseReward(w, 'weapon');
      const item = w.inventory.find((entry) => entry.kind === 'weapon');
      return item?.kind === 'weapon' && item.weapon.special;
    });
    const specials = rolls.filter(Boolean).length;
    expect(specials).toBeGreaterThanOrEqual(55);
    expect(specials).toBeLessThanOrEqual(85);
  });

  it('puts armour, jewellery and offhand choices in the bag, never directly on the body', () => {
    for (const kind of ['armour', 'jewellery', 'offhand'] as const) {
      const w = acquire(400 + kind.length);
      const worn = { ...w.gear };
      expect(chooseReward(w, kind)).toBe(true);
      expect(w.inventory.some((entry) => entry.kind === 'gear')).toBe(true);
      expect(w.gear).toEqual(worn);
    }
  });

  it('pauses the clock and gives the same result for the same seed and choice', () => {
    const a = acquire(145);
    const b = acquire(145);
    const time = a.time;
    stepWorld(a, { mx: 1, my: 0 });
    expect(a.time).toBe(time);
    chooseReward(a, 'offhand');
    chooseReward(b, 'offhand');
    expect(a.inventory).toEqual(b.inventory);
  });
});

describe('skipping acquirement only', () => {
  it('can collect gold only once per acquirement', () => {
    const w = acquire(207);
    const difficulty = w.dungeonGraph.nodes.get(w.depth)!.difficulty;
    const before = w.gold;
    expect(skipReward(w, 'gold')).toBe(true);
    expect(w.gold).toBe(before + 10 + 5 * difficulty);
    expect(skipReward(w, 'gold')).toBe(false);
  });

  it('heals HP and MP without exceeding their maxima', () => {
    const w = acquire(208, 'deep_elf', 'air_mage');
    w.hero.hp = w.hero.maxHp - 1;
    w.hero.mana = w.hero.maxMana - 1;
    expect(skipReward(w, 'heal')).toBe(true);
    expect(w.hero.hp).toBe(w.hero.maxHp);
    expect(w.hero.mana).toBe(w.hero.maxMana);
  });

  it('cannot skip a slot enhancement', () => {
    const w = makeWorld({ monsters: false, items: false });
    w.pendingRewards.push('slot');
    expect(skipReward(w, 'gold')).toBe(false);
    expect(w.pendingRewards).toEqual(['slot']);
  });
});
