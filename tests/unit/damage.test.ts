import { describe, expect, it } from 'vitest';
import { damageAfterDefense, resistanceFactor } from '../../src/sim/damage';
import { applyWeaponBrand } from '../../src/sim/brands';
import { hurtHero } from '../../src/sim/effects';
import { spawnMonster } from '../../src/sim/monster';
import { plainAxe } from '../../src/data/items';
import { arena } from './arena';

describe('physical and elemental damage', () => {
  it('keeps the existing resistance multiplier exactly', () => {
    expect([-1, 0, 1, 2, 3].map(resistanceFactor)).toEqual([2, 1, 0.5, 0.25, 0]);
  });

  it('uses armour only for physical damage, resistance only for elemental damage', () => {
    const resists = { fire: 2 };
    expect(damageAfterDefense(12, 'physical', 3, resists)).toBe(9);
    expect(damageAfterDefense(8, 'fire', 3, resists)).toBe(2);
    expect(damageAfterDefense(8, 'fire', 99, resists)).toBe(2);
    expect(damageAfterDefense(8, 'fire', 0, { fire: 3 })).toBe(0);
    expect(damageAfterDefense(8, 'fire', 0, { fire: -1 })).toBe(16);
  });

  it('splits received physical and fire damage into separate events', () => {
    const w = arena();
    Object.defineProperty(w, 'heroDef', { value: { ...w.heroDef, resists: { fire: 1 } } });
    w.hero.skills.armour = 3;
    w.hero.hp = w.hero.maxHp;
    hurtHero(w, 10, 'melee', undefined, { type: 'fire', damage: 6 });
    expect(w.events).toContainEqual({ type: 'hurt', x: w.hero.x, y: w.hero.y, amount: 7 });
    expect(w.events).toContainEqual({
      type: 'elemental',
      x: w.hero.x,
      y: w.hero.y,
      amount: 3,
      element: 'fire',
      target: 'hero',
    });
    expect(w.hero.hp).toBe(w.hero.maxHp - 10);
  });

  it('applies weapon fire resistance independently and emits coloured-element data', () => {
    const w = arena();
    const m = spawnMonster(w, 'ogre', 12, 10, true);
    Object.defineProperty(m, 'stats', { value: { ...m.stats, resists: { fire: 2 } } });
    w.weapon = { ...plainAxe('war_axe'), brand: 'flame' };
    const before = m.hp;
    applyWeaponBrand(w, m);
    expect(m.hp).toBe(before - 1);
    expect(w.events).toContainEqual({
      type: 'elemental',
      x: m.x,
      y: m.y,
      amount: 1,
      element: 'fire',
      target: 'monster',
    });
  });
});
