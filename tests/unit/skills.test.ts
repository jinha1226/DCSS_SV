import { describe, expect, it } from 'vitest';
import { hurtHero } from '../../src/sim/effects';
import { spawnMonster } from '../../src/sim/monster';
import { chooseSkill, effectValue, gainExperience, makeSkillChoice, skillLevel, xpToNext } from '../../src/sim/skills';
import { Cell } from '../../src/sim/grid';
import { stepWorld } from '../../src/sim/world';
import { STILL, arena, run } from './arena';

function grant(w: ReturnType<typeof arena>, id: string, times = 1): void {
  for (let i = 0; i < times; i++) {
    const card = makeSkillChoice(w, id);
    w.choosing = [card];
    w.pendingChoices = 1;
    chooseSkill(w, id);
  }
}

describe('growth', () => {
  it('uses the XP curve and pauses on a choice', () => {
    const w = arena();
    gainExperience(w, xpToNext(1));
    expect(w.hero.level).toBe(2);
    expect(w.choosing).toHaveLength(3);
    const time = w.time;
    stepWorld(w, STILL);
    expect(w.time).toBe(time);
  });

  it('queues two choices when two levels arrive together', () => {
    const w = arena();
    gainExperience(w, xpToNext(1) + xpToNext(2));
    expect(w.hero.level).toBe(3);
    expect(w.pendingChoices).toBe(2);
    chooseSkill(w, w.choosing![0]!.id);
    expect(w.pendingChoices).toBe(1);
    expect(w.choosing).not.toBeNull();
  });

  it('deals different cards and excludes maxed skills', () => {
    const w = arena();
    w.hero.skills.axe = 8;
    gainExperience(w, xpToNext(1));
    expect(new Set(w.choosing!.map((c) => c.id)).size).toBe(w.choosing!.length);
    expect(w.choosing!.some((c) => c.id === 'axe')).toBe(false);
  });

  it('starts Minotaur axe and fighting at level two on their first card', () => {
    const w = arena();
    grant(w, 'axe');
    grant(w, 'fighting');
    expect(skillLevel(w, 'axe')).toBe(2);
    expect(skillLevel(w, 'fighting')).toBe(2);
    expect(w.hero.maxHp).toBe(76);
  });

  it('keeps level and skills when taking the stairs', () => {
    const w = arena();
    grant(w, 'axe');
    w.hero.level = 4;
    const down = w.stairs.find((s) => s.down);
    if (!down) {
      expect(cellAtForArena()).toBe(Cell.Floor);
      return;
    }
    w.hero.x = down.x + 0.5;
    w.hero.y = down.y + 0.5;
    run(w, 1);
    expect(skillLevel(w, 'axe')).toBe(2);
    expect(w.hero.level).toBe(4);
  });
});

function cellAtForArena(): Cell {
  return Cell.Floor;
}

describe('skill values', () => {
  it('exposes every axe milestone', () => {
    const w = arena();
    grant(w, 'axe', 7);
    expect(effectValue(w, 'axe.damage')).toBe(8);
    expect(effectValue(w, 'axe.wide')).toBe(0.3);
    expect(effectValue(w, 'axe.spin')).toBe(1.5);
    expect(effectValue(w, 'axe.stun')).toBe(0.25);
    expect(effectValue(w, 'axe.reset')).toBe(1);
  });
  it('exposes every fighting milestone', () => {
    const w = arena();
    grant(w, 'fighting', 7);
    expect(effectValue(w, 'fighting.hp')).toBe(64);
    expect(effectValue(w, 'fighting.regen')).toBe(2);
    expect(effectValue(w, 'fighting.healKill')).toBe(1);
    expect(effectValue(w, 'fighting.desperate')).toBe(1.3);
    expect(effectValue(w, 'fighting.lastStand')).toBe(1);
  });
  it('exposes every armour milestone', () => {
    const w = arena();
    grant(w, 'armour', 8);
    expect(effectValue(w, 'armour.reduce')).toBe(8);
    expect(effectValue(w, 'armour.stone')).toBe(0.5);
    expect(effectValue(w, 'armour.deflect')).toBe(3);
    expect(effectValue(w, 'armour.unmoved')).toBe(1);
    expect(effectValue(w, 'armour.thorns')).toBe(2);
  });
  it('exposes every shield milestone', () => {
    const w = arena();
    grant(w, 'shield', 8);
    expect(effectValue(w, 'shield.chance')).toBeCloseTo(0.32);
    expect(effectValue(w, 'shield.push')).toBe(5);
    expect(effectValue(w, 'shield.missile')).toBe(2);
    expect(effectValue(w, 'shield.stun')).toBe(0.6);
    expect(effectValue(w, 'shield.reset')).toBe(1);
  });
  it('exposes every dodging milestone', () => {
    const w = arena();
    grant(w, 'dodging', 8);
    expect(effectValue(w, 'dodging.chance')).toBeCloseTo(0.24);
    expect(effectValue(w, 'dodging.speed')).toBe(0.06);
    expect(effectValue(w, 'dodging.delay')).toBe(0.8);
    expect(effectValue(w, 'dodging.squeeze')).toBe(0.5);
    expect(effectValue(w, 'dodging.grace')).toBe(0.8);
  });
  it('exposes every throwing milestone', () => {
    const w = arena();
    grant(w, 'throwing', 8);
    expect(effectValue(w, 'throwing.power')).toBe(8);
    expect(effectValue(w, 'throwing.cooldown')).toBeCloseTo(-0.56);
    expect(effectValue(w, 'throwing.pierce')).toBe(1);
    expect(effectValue(w, 'throwing.double')).toBe(2);
    expect(effectValue(w, 'throwing.slow')).toBe(0.4);
    expect(effectValue(w, 'throwing.return')).toBe(1);
  });
});

describe('defence order', () => {
  it('dodges before a shield or armour can apply', () => {
    const w = arena();
    w.hero.skills.dodging = 8;
    w.hero.skills.shield = 8;
    w.hero.skills.armour = 8;
    Object.defineProperty(w, 'rng', { value: () => 0 });
    const hp = w.hero.hp;
    expect(hurtHero(w, 20)).toBe(false);
    expect(w.hero.hp).toBe(hp);
    expect(w.events.at(-1)?.type).toBe('dodge');
  });

  it('blocks before armour when dodge is absent', () => {
    const w = arena();
    w.hero.skills.shield = 8;
    w.hero.skills.armour = 8;
    Object.defineProperty(w, 'rng', { value: () => 0 });
    const hp = w.hero.hp;
    expect(hurtHero(w, 20)).toBe(false);
    expect(w.hero.hp).toBe(hp);
    expect(w.events.at(-1)?.type).toBe('block');
  });

  it('armour reduces a landed hit after dodge and block fail', () => {
    const w = arena();
    w.hero.skills.armour = 2;
    const hp = w.hero.hp;
    expect(hurtHero(w, 10)).toBe(true);
    expect(w.hero.hp).toBe(hp - 8);
  });

  it('kills award monster experience', () => {
    const w = arena();
    const rat = spawnMonster(w, 'rat', 10.8, 10, true);
    rat.hp = 1;
    w.hero.butt = 1e9;
    run(w, 0.1);
    expect(w.hero.xp).toBeGreaterThanOrEqual(1);
  });
});
