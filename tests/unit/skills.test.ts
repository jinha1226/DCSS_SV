import { describe, expect, it } from 'vitest';
import { plainAxe, plainBow } from '../../src/data/items';
import { hurtHero } from '../../src/sim/effects';
import { recordKill } from '../../src/sim/kills';
import { spawnMonster } from '../../src/sim/monster';
import { chooseReward } from '../../src/sim/rewards';
import { gainExperience, openSkill, skillCap, skillLevel, skillXpToNext, trainSkills, xpToNext } from '../../src/sim/skills';
import { STEP, makeWorld, stepWorld } from '../../src/sim/world';
import { STILL, arena } from './arena';

describe('automatic skill training', () => {
  it('trains four shared skills independently, including unused Spellcasting', () => {
    const w = arena();
    const beforeHp = w.hero.maxHp;
    const beforeMana = w.hero.maxMana;
    trainSkills(w, 220);
    for (const id of ['fighting', 'armour', 'dodging', 'spellcasting']) {
      expect(skillLevel(w, id)).toBeGreaterThan(0);
    }
    expect(skillLevel(w, 'axe')).toBeGreaterThan(1);
    expect(w.hero.maxHp).toBeGreaterThan(beforeHp);
    expect(w.hero.maxMana).toBeGreaterThan(beforeMana);
    expect(skillLevel(w, 'shield')).toBe(0);
  });

  it('trains only the currently equipped weapon family and retains previous progress', () => {
    const w = arena();
    trainSkills(w, 16);
    const oldAxe = skillLevel(w, 'axe');
    const oldXp = w.hero.skillXp.axe;
    w.weapon = plainBow('shortbow', 'test-bow');
    trainSkills(w, 150);
    expect(skillLevel(w, 'ranged')).toBeGreaterThan(0);
    expect(skillLevel(w, 'axe')).toBe(oldAxe);
    expect(w.hero.skillXp.axe).toBe(oldXp);
    w.weapon = plainAxe('hand_axe', 'test-axe');
    trainSkills(w, 150);
    expect(skillLevel(w, 'axe')).toBeGreaterThan(oldAxe);
  });

  it('does not train the decorative starting weapon of a magic attacker', () => {
    const w = makeWorld({ species: 'deep_elf', job: 'air_mage', items: false, monsters: false });
    const before = skillLevel(w, 'axe');
    trainSkills(w, 150);
    expect(skillLevel(w, 'axe')).toBe(before);
    expect(skillLevel(w, 'air')).toBeGreaterThan(1);
    expect(skillLevel(w, 'spellcasting')).toBeGreaterThan(0);
  });

  it('requires a real shield and one-handed weapon for Shields training', () => {
    const w = arena();
    trainSkills(w, 120);
    expect(skillLevel(w, 'shield')).toBe(0);
    w.gear.offhand = 'buckler';
    trainSkills(w, 120);
    const trained = skillLevel(w, 'shield');
    expect(trained).toBeGreaterThan(0);
    w.weapon = plainAxe('battle_axe', 'two-handed');
    trainSkills(w, 120);
    expect(skillLevel(w, 'shield')).toBe(trained);
    w.weapon = plainAxe('hand_axe', 'one-handed');
    trainSkills(w, 120);
    expect(skillLevel(w, 'shield')).toBeGreaterThan(trained);
  });

  it('does not train unequipped schools, because equipment determines training', () => {
    const w = arena();
    trainSkills(w, 200);
    expect(skillLevel(w, 'fire')).toBe(0);
    openSkill(w, 'fire');
    trainSkills(w, 200);
    expect(skillLevel(w, 'fire')).toBe(0);
  });

  it('keeps the same cap for all aptitudes but a fast aptitude advances sooner', () => {
    const fast = makeWorld({ species: 'minotaur', job: 'berserker', items: false, monsters: false });
    const slow = makeWorld({ species: 'deep_elf', job: 'air_mage', items: false, monsters: false });
    trainSkills(fast, 200);
    trainSkills(slow, 200);
    expect(skillCap(fast, 'fighting')).toBe(27);
    expect(skillCap(slow, 'fighting')).toBe(27);
    expect(skillLevel(fast, 'fighting')).toBeGreaterThan(skillLevel(slow, 'fighting'));
    trainSkills(fast, 100_000);
    trainSkills(slow, 100_000);
    expect(skillLevel(fast, 'fighting')).toBe(27);
    expect(skillLevel(slow, 'fighting')).toBe(27);
  });

  it('does not grant any progress for waiting or being struck without earned XP', () => {
    const w = arena();
    const snapshot = { ...w.hero.skills };
    stepWorld(w, STILL, STEP);
    hurtHero(w, 2);
    expect(w.hero.skills).toEqual(snapshot);
    expect(w.hero.skillXp).toEqual({});
  });

  it('trains with normal kills but refuses XP from deadline pursuers', () => {
    const w = arena();
    const pursuer = spawnMonster(w, 'rat', 10.8, 10, true);
    pursuer.rewardless = true;
    pursuer.hp = 0;
    const xp = w.hero.xp;
    recordKill(w, pursuer);
    expect(w.hero.xp).toBe(xp);
    expect(w.hero.skillXp).toEqual({});
    const normal = spawnMonster(w, 'rat', 11.8, 10, true);
    normal.hp = 0;
    recordKill(w, normal);
    expect(w.hero.xp).toBeGreaterThan(xp);
    expect(w.hero.skillXp.fighting).toBeGreaterThan(0);
  });

  it('retains partial skill XP across floors and respects threshold boundaries', () => {
    const w = arena();
    const threshold = skillXpToNext(1);
    trainSkills(w, threshold / 1.5 - 0.1);
    expect(skillLevel(w, 'fighting')).toBe(1);
    trainSkills(w, 0.11);
    expect(skillLevel(w, 'fighting')).toBe(2);
    expect(w.hero.skillXp.fighting).toBeGreaterThanOrEqual(0);
  });
});

describe('level rewards', () => {
  it('replaces skill cards with three different item categories and pauses simulation time', () => {
    const w = arena();
    gainExperience(w, xpToNext(1));
    expect(w.hero.level).toBe(2);
    expect(w.choosing).toBeNull();
    expect(w.rewardChoices?.map((card) => card.kind)).toEqual(['weapon', 'gear', 'consumable']);
    const time = w.time;
    stepWorld(w, STILL);
    expect(w.time).toBe(time);
  });

  it('queues simultaneous level rewards and consumes each exactly once', () => {
    const w = arena();
    gainExperience(w, xpToNext(1) + xpToNext(2));
    expect(w.pendingChoices).toBe(2);
    const first = w.rewardChoices![0]!;
    expect(chooseReward(w, first.id)).toBe(true);
    expect(w.pendingChoices).toBe(1);
    expect(w.rewardChoices).not.toBeNull();
    expect(chooseReward(w, w.rewardChoices![0]!.id)).toBe(true);
    expect(w.pendingChoices).toBe(0);
    expect(w.rewardChoices).toBeNull();
    expect(chooseReward(w, first.id)).toBe(false);
  });
});
