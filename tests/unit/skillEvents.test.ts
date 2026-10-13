import { describe, expect, it } from 'vitest';
import { unlockedPerks } from '../../src/data/skills';
import { chooseSkill, skillLevel, skillXpToNext, trainSkills } from '../../src/sim/skills';
import { arena } from './arena';

describe('skill level-up events', () => {
  it('reports a skill crossing its next threshold', () => {
    const w = arena();
    const from = skillLevel(w, 'fighting');
    w.hero.skillXp.fighting = skillXpToNext(from) - 0.1;
    w.events.length = 0;
    trainSkills(w, 0.1);
    expect(w.events).toContainEqual({ type: 'skill', id: 'fighting', from, level: from + 1 });
  });

  it('does not report a skill below its next threshold', () => {
    const w = arena();
    w.events.length = 0;
    trainSkills(w, 0.01);
    expect(w.events.some((event) => event.type === 'skill')).toBe(false);
  });

  it('reports one event with the final level after a multi-level gain', () => {
    const w = arena();
    const from = skillLevel(w, 'fighting');
    w.events.length = 0;
    trainSkills(w, 100);
    const events = w.events.filter((event) => event.type === 'skill' && event.id === 'fighting');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'skill', id: 'fighting', from, level: skillLevel(w, 'fighting') });
    expect(skillLevel(w, 'fighting')).toBeGreaterThan(from + 1);
  });

  it('reports skill gains from the legacy choice path', () => {
    const w = arena();
    const from = skillLevel(w, 'fighting');
    w.choosing = [{ id: 'fighting', name: '전투', from, to: from + 1, gain: 1, cap: 27, line: '테스트' }];
    w.events.length = 0;
    chooseSkill(w, 'fighting');
    expect(w.events).toContainEqual({ type: 'skill', id: 'fighting', from, level: from + 1 });
  });
});

describe('unlocked perks', () => {
  it('returns only perks crossed on the way to the new level', () => {
    expect(unlockedPerks('fighting', 1, 2)).toContain('체력이 두 배 빨리 찬다');
    expect(unlockedPerks('fighting', 2, 2)).toEqual([]);
  });
});
