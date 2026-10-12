import { describe, expect, it } from 'vitest';
import { plainWeapon } from '../../src/data/items';
import { spawnMonster } from '../../src/sim/monster';
import { castPaidSpell, setSpellSlot, stepSpells } from '../../src/sim/spells';
import type { Monster, World } from '../../src/sim/types';
import { arena } from './arena';

function target(w: World, x: number, y: number, hp = 500): Monster {
  const m = spawnMonster(w, 'ogre', x, y, true);
  m.hp = hp;
  return m;
}

/** A master staff of the school, every spell unlocked, the staff's own attack held back. */
function mage(school: string): World {
  const w = arena();
  w.weapon = plainWeapon('staff_' + school + '_2');
  w.hero.skills[school] = 27;
  w.hero.maxMana = 500;
  w.hero.mana = 500;
  w.hero.autoCooldown = 1e9;
  w.visible.fill(1);
  return w;
}

function cast(w: World, spellId: string, at?: Monster): boolean {
  setSpellSlot(w, 0, spellId);
  return castPaidSpell(w, spellId, at);
}

function run(w: World, seconds: number): void {
  for (let t = 0; t < seconds; t += 0.05) stepSpells(w, 0.05);
}

describe('cone', () => {
  it('hits in front of the hero but not behind', () => {
    const w = mage('ice');
    const front = target(w, 12.5, 10);
    const side = target(w, 12, 11);
    const behind = target(w, 8, 10);
    expect(cast(w, 'cold_fan', front)).toBe(true);
    expect(front.hp).toBeLessThan(500);
    expect(side.hp).toBeLessThan(500);
    expect(behind.hp).toBe(500);
    expect(front.slow).toBeGreaterThan(0);
  });
});

describe('chain', () => {
  it('jumps from monster to monster up to its target count, never twice to one', () => {
    const w = arena();
    w.weapon = plainWeapon('staff_air_1');
    w.hero.skills.air = 27;
    w.visible.fill(1);
    const a = target(w, 12, 10);
    const b = target(w, 14, 10);
    const c = target(w, 16, 10);
    const d = target(w, 18, 10);
    const far = target(w, 12, 17);
    stepSpells(w, 0.05);
    for (const m of [a, b, c]) expect(m.hp).toBeLessThan(500);
    expect(d.hp).toBe(500);
    expect(far.hp).toBe(500);
    expect(w.spellVisuals.some((visual) => visual.shape === 'chain' && visual.points?.length === 4)).toBe(true);
  });
});

describe('ongoing spells', () => {
  it('an aura follows the hero and burns what comes close', () => {
    const w = mage('fire');
    expect(cast(w, 'flame_ring')).toBe(true);
    const close = target(w, 11, 10);
    const far = target(w, 15, 10);
    run(w, 1);
    expect(close.hp).toBeLessThan(500);
    expect(far.hp).toBe(500);
    w.hero.x = 14;
    run(w, 0.6);
    expect(far.hp).toBeLessThan(500);
    run(w, 5);
    expect(w.spellOngoing).toHaveLength(0);
  });

  it('a storm keeps bursting near monsters for its duration', () => {
    const w = mage('fire');
    const m = target(w, 13, 10);
    expect(cast(w, 'firestorm')).toBe(true);
    run(w, 1);
    const mid = m.hp;
    expect(mid).toBeLessThan(500);
    run(w, 1);
    expect(m.hp).toBeLessThan(mid);
  });

  it('a delayed blast waits, then hits everything in its circle once', () => {
    const w = mage('fire');
    const m = target(w, 14, 10);
    const near = target(w, 15.5, 11);
    expect(cast(w, 'sunfall', m)).toBe(true);
    run(w, 1);
    expect(m.hp).toBe(500);
    run(w, 0.6);
    expect(m.hp).toBeLessThan(500);
    expect(near.hp).toBeLessThan(500);
    const after = m.hp;
    run(w, 2);
    expect(m.hp).toBe(after);
  });

  it('an earthquake strikes every visible monster once and stuns it', () => {
    const w = mage('earth');
    const a = target(w, 13, 10);
    const b = target(w, 6, 15);
    expect(cast(w, 'earthquake')).toBe(true);
    run(w, 0.1);
    expect(a.hp).toBeLessThan(500);
    expect(b.hp).toBeLessThan(500);
    expect(a.stun).toBeGreaterThan(0);
    const hp = a.hp;
    run(w, 2);
    expect(a.hp).toBe(hp);
  });
});

describe('marks', () => {
  it('a cinder brand explodes when the marked monster dies and brands those it burns', () => {
    const w = mage('fire');
    const marked = target(w, 13, 10, 500);
    const neighbour = target(w, 14, 10, 500);
    expect(cast(w, 'cinder_brand', marked)).toBe(true);
    expect(marked.mark?.spellId).toBe('cinder_brand');
    marked.hp = 0.1;
    w.hero.autoCooldown = 0;
    w.weapon = plainWeapon('staff_fire_0');
    w.hero.skills.fire = 27;
    run(w, 1);
    expect(neighbour.hp).toBeLessThan(500);
    expect(neighbour.mark?.spellId).toBe('cinder_brand');
  });

  it('a death mark feeds the hero when the marked monster dies', () => {
    const w = mage('necromancy');
    const marked = target(w, 12, 10, 1);
    w.hero.hp = 5;
    expect(cast(w, 'death_mark', marked)).toBe(true);
    w.hero.autoCooldown = 0;
    w.weapon = plainWeapon('staff_necromancy_0');
    run(w, 1);
    expect(w.hero.hp).toBeGreaterThan(5);
  });
});

describe('projectile extras', () => {
  it('a homing shot curves onto a target it was not aimed straight at', () => {
    const w = arena();
    w.weapon = plainWeapon('staff_summoning_1');
    w.hero.skills.summoning = 27;
    w.visible.fill(1);
    const m = target(w, 15, 13);
    stepSpells(w, 0.05);
    const shot = w.spellShots[0]!;
    m.x = 15;
    m.y = 7;
    run(w, 1.5);
    expect(shot.hit).toContain(m);
  });

  it('a fireball bursts on impact and catches a monster beside its target', () => {
    const w = arena();
    w.weapon = plainWeapon('staff_fire_1');
    w.hero.skills.fire = 27;
    w.visible.fill(1);
    const m = target(w, 14, 10);
    const beside = target(w, 14.5, 11);
    run(w, 0.5);
    expect(m.hp).toBeLessThan(500);
    expect(beside.hp).toBeLessThan(500);
  });

  it('a lava lance leaves flames behind it, and ball lightning zaps beside its path', () => {
    const w = arena();
    w.weapon = plainWeapon('staff_fire_2');
    w.hero.skills.fire = 27;
    w.visible.fill(1);
    target(w, 17, 10);
    run(w, 0.2);
    expect(w.spellClouds.length).toBeGreaterThan(0);

    const z = arena();
    z.weapon = plainWeapon('staff_air_2');
    z.hero.skills.air = 15;
    z.visible.fill(1);
    target(z, 17, 10);
    const beside = target(z, 13, 11.2);
    run(z, 1.2);
    expect(beside.hp).toBeLessThan(500);
  });
});
