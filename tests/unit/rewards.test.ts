import { describe, expect, it } from 'vitest';
import { chooseReward, skipReward } from '../../src/sim/rewards';
import { gainExperience, xpToNext } from '../../src/sim/skills';
import { makeWorld, stepWorld } from '../../src/sim/world';

function levelUp(seed: number, species = 'minotaur', job = 'berserker') {
  const w = makeWorld({ seed, species, job, monsters: false, items: false });
  gainExperience(w, xpToNext(1));
  return w;
}

describe('level-up item reward integration', () => {
  it('has seed-stable, non-artefact offers of one weapon, one gear and one supply', () => {
    const a = levelUp(145),
      b = levelUp(145);
    expect(a.rewardChoices).toEqual(b.rewardChoices);
    expect(a.rewardChoices?.map((card) => card.kind)).toEqual(['weapon', 'gear', 'consumable']);
    expect(a.rewardChoices![0]?.weapon?.special).toBe(false);
    expect(a.rewardChoices![0]?.weapon?.brand).toBeUndefined();
    expect(a.rewardChoices![0]?.weapon?.options).toEqual([]);
  });

  it('stores a rewarded weapon without replacing the equipped weapon or starting a ground pickup', () => {
    const w = levelUp(201);
    const original = w.weapon;
    const offer = w.rewardChoices!.find((card) => card.kind === 'weapon')!;
    expect(chooseReward(w, offer.id)).toBe(true);
    expect(w.weapon).toBe(original);
    expect(w.pendingPickup).toBeNull();
    expect(w.inventory.some((entry) => entry.kind === 'weapon' && entry.uid === offer.weapon!.uid)).toBe(true);
    expect(chooseReward(w, offer.id)).toBe(false);
  });

  it('puts awarded armour in the bag without silently equipping it', () => {
    const w = levelUp(202);
    const offer = w.rewardChoices!.find((card) => card.kind === 'gear')!;
    expect(chooseReward(w, offer.id)).toBe(true);
    expect(w.inventory.some((entry) => entry.kind === 'gear' && entry.id === offer.itemId)).toBe(true);
    expect(Object.values(w.gear)).toHaveLength(0);
  });

  it('stacks awarded consumables and identifies the chosen item', () => {
    const w = levelUp(203);
    const offer = w.rewardChoices!.find((card) => card.kind === 'consumable')!;
    expect(chooseReward(w, offer.id)).toBe(true);
    expect(w.inventory).toContainEqual(expect.objectContaining({ kind: 'consumable', id: offer.itemId, count: 1 }));
    expect(w.identifiedItems.has(offer.itemId!)).toBe(true);
  });

  it('cannot tick a paused reward and continues with the same game clock after choosing', () => {
    const w = levelUp(204);
    const t = w.time;
    stepWorld(w, { mx: 1, my: 0 });
    expect(w.time).toBe(t);
    expect(chooseReward(w, 'invalid')).toBe(false);
    expect(w.rewardChoices).not.toBeNull();
    chooseReward(w, w.rewardChoices![2]!.id);
    stepWorld(w, { mx: 1, my: 0 });
    expect(w.time).toBeGreaterThan(t);
  });

  it('gives one reward per level even when multiple levels are gained at once', () => {
    const w = makeWorld({ seed: 205, monsters: false, items: false });
    gainExperience(w, xpToNext(1) + xpToNext(2) + xpToNext(3));
    expect(w.pendingChoices).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(w.rewardChoices).not.toBeNull();
      expect(chooseReward(w, w.rewardChoices![2]!.id)).toBe(true);
    }
    expect(w.rewardChoices).toBeNull();
    expect(w.pendingChoices).toBe(0);
    expect(w.inventory.filter((item) => item.kind === 'consumable').length).toBeGreaterThan(0);
  });
});

describe('skipping item rewards', () => {
  it('can collect gold only once per offer', () => {
    const w = levelUp(207);
    const difficulty = w.dungeonGraph.nodes.get(w.depth)!.difficulty;
    const before = w.gold;
    expect(skipReward(w, 'gold')).toBe(true);
    expect(w.gold).toBe(before + 10 + 5 * difficulty);
    expect(skipReward(w, 'gold')).toBe(false);
  });
  it('heals HP and MP without exceeding their maxima', () => {
    const w = levelUp(208, 'deep_elf', 'conjurer');
    w.hero.hp = w.hero.maxHp - 1;
    w.hero.mana = w.hero.maxMana - 1;
    expect(skipReward(w, 'heal')).toBe(true);
    expect(w.hero.hp).toBe(w.hero.maxHp);
    expect(w.hero.mana).toBe(w.hero.maxMana);
  });
});
