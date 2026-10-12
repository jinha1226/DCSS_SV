import { describe, expect, it } from 'vitest';
import { plainWeapon } from '../../src/data/items';
import { spellData } from '../../src/data/spells';
import { hurtHero } from '../../src/sim/effects';
import { hurtMonster } from '../../src/sim/hits';
import { spawnMonster } from '../../src/sim/monster';
import { heroSpeed } from '../../src/sim/skills';
import { applySpellHit, tickSpellEffects } from '../../src/sim/spellEffects';
import { castPaidSpell, setSpellSlot, stepSpells } from '../../src/sim/spells';
import type { Monster, World } from '../../src/sim/types';
import { arena } from './arena';

/** A sturdy target that will not die from a few test hits. */
function target(w: World, x = 13, y = 10): Monster {
  const m = spawnMonster(w, 'ogre', x, y, true);
  m.hp = 500;
  return m;
}

/** Equips a master staff of a school with every spell unlocked and plenty of mana. */
function mage(w: World, school: string): World {
  w.weapon = plainWeapon('staff_' + school + '_2');
  w.hero.skills[school] = 27;
  w.hero.maxMana = 200;
  w.hero.mana = 200;
  return w;
}

describe('spell riders on monsters', () => {
  it('slows, stuns and confuses', () => {
    const w = arena();
    const m = target(w);
    applySpellHit(w, 'frost_needle', m, 5, w.hero);
    expect(m.slow).toBeCloseTo(1.5);
    expect(m.slowScale).toBeCloseTo(0.3);
    applySpellHit(w, 'pulse_burst', m, 5, w.hero);
    expect(m.stun).toBeCloseTo(0.6);
  });

  it('knocks back away from the source and pulls towards it', () => {
    const w = arena();
    const m = target(w, 13, 10);
    applySpellHit(w, 'rolling_boulder', m, 5, { x: 10, y: 10 });
    expect(m.kx).toBeGreaterThan(0);
    applySpellHit(w, 'gravity_bloom', m, 5, { x: 10, y: 10 });
    expect(m.kx).toBeLessThan(0);
  });

  it('drain heals the hero by a share of the damage dealt, never above maximum', () => {
    const w = arena();
    const m = target(w);
    w.hero.hp = w.hero.maxHp - 10;
    applySpellHit(w, 'life_drain', m, 8, w.hero);
    expect(w.hero.hp).toBe(w.hero.maxHp - 6);
    applySpellHit(w, 'life_drain', m, 100, w.hero);
    expect(w.hero.hp).toBe(w.hero.maxHp);
  });

  it('poison deals damage in half-second steps and then wears off', () => {
    const w = arena();
    const m = target(w);
    applySpellHit(w, 'venom_dart', m, 0, w.hero);
    const before = m.hp;
    for (let i = 0; i < 70; i++) tickSpellEffects(w, 0.05);
    expect(m.hp).toBeLessThan(before);
    expect(m.poison).toBeLessThanOrEqual(0);
    const after = m.hp;
    for (let i = 0; i < 20; i++) tickSpellEffects(w, 0.05);
    expect(m.hp).toBe(after);
  });

  it('vulnerability raises damage taken and rot strips armour', () => {
    const w = arena();
    const m = target(w);
    const plain = hurtMonster(w, m, 10, 'fire').damage;
    applySpellHit(w, 'weakness_bolt', m, 0, w.hero);
    expect(hurtMonster(w, m, 10, 'fire').damage).toBeGreaterThan(plain);

    const armoured = target(w, 14, 12);
    (armoured as { stats: Monster['stats'] }).stats = { ...armoured.stats, armour: 4 };
    const blunt = hurtMonster(w, armoured, 6, 'physical').damage;
    armoured.rot = 3;
    armoured.rotArmour = 3;
    expect(hurtMonster(w, armoured, 6, 'physical').damage).toBe(blunt + 3);
  });

  it('a monster caster only poisons the hero; other riders do nothing to the hero', () => {
    const w = arena();
    applySpellHit(w, 'pulse_burst', w.hero, 5, w.hero);
    applySpellHit(w, 'rolling_boulder', w.hero, 5, { x: 0, y: 0 });
    expect(w.hero.invulnerable).toBe(0);
    applySpellHit(w, 'venom_dart', w.hero, 5, w.hero);
    expect(w.hero.poison).toBeCloseTo(3);
  });
});

describe('cast riders through real spell shapes', () => {
  it('a slowing cloud slows monsters inside it without showing zero-damage hits', () => {
    const w = mage(arena(), 'hexes');
    const m = target(w, 13, 10);
    w.hero.autoCooldown = 99; // keep the staff's own attack out of this check
    w.events.length = 0;
    expect(castPaidSpell(w, 'slowing_field', m)).toBe(true);
    stepSpells(w, 0.05);
    expect(m.slow).toBeGreaterThan(0);
    expect(w.events.some((event) => event.type === 'hit')).toBe(false);
  });

  it('a stunning burst stuns every monster it catches', () => {
    const w = mage(arena(), 'earth');
    setSpellSlot(w, 0, 'pulse_burst');
    const a = target(w, 13, 10);
    const b = target(w, 13.6, 10);
    const far = target(w, 17, 16);
    expect(castPaidSpell(w, 'pulse_burst', a)).toBe(true);
    expect(a.stun).toBeGreaterThan(0);
    expect(b.stun).toBeGreaterThan(0);
    expect(far.stun).toBe(0);
  });
});

describe('buff and debuff spells', () => {
  it('ice armour lowers physical damage taken until it runs out', () => {
    const w = mage(arena(), 'ice');
    (w as unknown as { rng: () => number }).rng = () => 0.99;
    const before = w.hero.hp;
    hurtHero(w, 8);
    const plain = before - w.hero.hp;
    expect(castPaidSpell(w, 'ice_armour')).toBe(true);
    const armoured = w.hero.hp;
    hurtHero(w, 8);
    expect(armoured - w.hero.hp).toBeLessThan(plain);
    tickSpellEffects(w, spellData('ice_armour').duration! + 0.1);
    expect(w.hero.armourBuffPower).toBe(0);
  });

  it('tailwind speeds the hero up', () => {
    const w = mage(arena(), 'air');
    w.weapon = plainWeapon('staff_air_1');
    const base = heroSpeed(w);
    expect(castPaidSpell(w, 'tailwind')).toBe(true);
    expect(heroSpeed(w)).toBeCloseTo(base * 1.35);
  });

  it('flash freeze stuns the target group, and confusion confuses it', () => {
    const w = mage(arena(), 'ice');
    const a = target(w, 13, 10);
    const b = target(w, 14, 11);
    const far = target(w, 17, 17);
    expect(castPaidSpell(w, 'flash_freeze', a)).toBe(true);
    expect(a.stun).toBeCloseTo(2);
    expect(b.stun).toBeCloseTo(2);
    expect(far.stun).toBe(0);

    const h = mage(arena(), 'hexes');
    const c = target(h, 13, 10);
    expect(castPaidSpell(h, 'confusion', c)).toBe(true);
    expect(c.confusion).toBeGreaterThan(0);
  });

  it('rot strips armour and deals its damage over time instead of at once', () => {
    const w = mage(arena(), 'necromancy');
    const m = target(w, 13, 10);
    const before = m.hp;
    expect(castPaidSpell(w, 'rot', m)).toBe(true);
    expect(m.hp).toBe(before);
    expect(m.rotArmour).toBe(3);
    for (let i = 0; i < 40; i++) tickSpellEffects(w, 0.05);
    expect(m.hp).toBeLessThan(before);
  });
});
