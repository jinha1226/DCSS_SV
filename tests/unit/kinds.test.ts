import { describe, expect, it } from 'vitest';
import { DCSS_TIME } from '../../src/data/dcssTime';
import { HERO } from '../../src/data/hero';
import { MONSTERS, POISON, monsterKind } from '../../src/data/monsters';
import { DUNGEON, PACKS } from '../../src/data/packs';
import { throwTarget } from '../../src/sim/combat';
import { Cell, carve, makeGrid, setCell } from '../../src/sim/grid';
import { spawnMonster } from '../../src/sim/monster';
import { STEP, makeWorld, stepWorld } from '../../src/sim/world';
import { STILL, arena, count, quietArena, run } from './arena';

const stats = (id: string) => monsterKind(id).stats;
const far = (m: { x: number; y: number }, w: { hero: { x: number; y: number } }): number => Math.hypot(m.x - w.hero.x, m.y - w.hero.y);

describe('the monster roster', () => {
  it('all fit a corridor one cell wide, and are wide enough that two do not share a cell', () => {
    expect(MONSTERS).toHaveLength(21);
    for (const m of MONSTERS) {
      expect(m.stats.radius, m.id).toBeLessThan(0.5);
      expect(m.stats.radius, m.id).toBeGreaterThanOrEqual(0.38);
    }
  });

  it('can each strike a hero they stand touching', () => {
    for (const m of MONSTERS) {
      if (m.stats.throws) continue;
      expect(m.stats.reach, m.id).toBeGreaterThan(m.stats.radius);
    }
  });

  it('walk at their DCSS speed: 10 is the base pace, and move energy slows or quickens it', () => {
    for (const m of MONSTERS) {
      const move = monsterKind(m.id).stats.dcssSpeed;
      expect(m.stats.speed, m.id).toBeGreaterThan(0);
      if (m.id === 'goblin') expect(m.stats.speed).toBeCloseTo(DCSS_TIME.monsterMove);
      if (m.id === 'naga') expect(m.stats.speed).toBeCloseTo((DCSS_TIME.monsterMove * move) / 14);
    }
    expect(stats('lair_wolf').speed).toBeCloseTo((DCSS_TIME.monsterMove * 17) / 10);
  });

  it('are slower than the hero, except the ones DCSS makes faster than a walking player', () => {
    const faster = MONSTERS.filter((m) => m.stats.speed >= HERO.speed).map((m) => m.id);
    expect(faster.sort()).toEqual(['bat', 'lair_wolf', 'wolf_spider']);
  });

  it('strike once per DCSS action: an ogre (attack energy 15) waits half again as long as a goblin', () => {
    const cycle = (id: string): number => stats(id).rest;
    expect(cycle('goblin')).toBeCloseTo(DCSS_TIME.monsterAttack);
    expect(cycle('ogre')).toBeCloseTo(DCSS_TIME.monsterAttack * 1.5);
    expect(cycle('jackal')).toBeCloseTo(Math.max(DCSS_TIME.monsterAttack * (10 / 14), stats('jackal').windup + DCSS_TIME.minRest));
  });

  it('are tougher on deeper floors', () => {
    const shallow = spawnMonster(arena(1), 'goblin', 5, 5, false);
    const deep = spawnMonster(arena(3), 'goblin', 5, 5, false);
    expect(shallow.hp).toBe(stats('goblin').hp);
    expect(deep.hp).toBe(Math.round(stats('goblin').hp * (1 + DUNGEON.tougher * 2)));
  });
});

describe('a bat', () => {
  it('darts off after it bites, then comes back', () => {
    const w = quietArena();
    const bat = spawnMonster(w, 'bat', 10.9, 10, true);
    bat.rest = 0;
    let bitten = false;
    let farthest = 0;
    for (let i = 0; i < Math.round(1.2 / STEP); i++) {
      stepWorld(w, STILL);
      if (count(w.events, 'hurt')) bitten = true;
      if (bitten) farthest = Math.max(farthest, far(bat, w));
    }
    expect(bitten).toBe(true);
    expect(farthest).toBeGreaterThan(2);
    run(w, 2.5);
    expect(count(run(w, 3), 'hurt')).toBeGreaterThanOrEqual(1);
  });
});

describe('a kobold', () => {
  it('keeps its distance and throws stones that hurt a hero who stands', () => {
    const w = quietArena();
    const k = spawnMonster(w, 'kobold', 15, 10, true);
    k.rest = 0;
    const events = run(w, 3);
    expect(count(events, 'hurt')).toBeGreaterThanOrEqual(1);
    expect(far(k, w)).toBeGreaterThan(3);
    expect(w.hero.hp).toBeLessThan(HERO.hp);
  });

  it('misses a hero who keeps walking across its aim', () => {
    // A long room, so the hero can walk for four seconds without meeting a wall: a hero stopped
    // by a wall is standing still as far as a stone is concerned.
    const grid = makeGrid(12, 40);
    carve(grid, 1, 1, 10, 38);
    const w = makeWorld({ floor: { grid, start: { x: 3, y: 3 }, rooms: [] }, monsters: false });
    w.hero.swing = w.hero.butt = 1e9;
    spawnMonster(w, 'kobold', 8, 3, true).rest = 0;
    let hurts = 0;
    let thrown = 0;
    for (let i = 0; i < Math.round(4 / STEP); i++) {
      const before = w.shots.length;
      stepWorld(w, { mx: 0, my: 1 });
      if (w.shots.length > before) thrown++;
      hurts += count(w.events, 'hurt');
    }
    expect(thrown).toBeGreaterThanOrEqual(1);
    expect(hurts).toBe(0);
    expect(w.hero.y).toBeGreaterThan(25);
  });

  it('cannot throw through a wall', () => {
    const w = quietArena();
    for (let y = 6; y <= 14; y++) setCell(w.grid, 12, y, Cell.Wall);
    run(w, 0.05, { mx: 0, my: 1 }); // a step, so the hero looks again
    spawnMonster(w, 'kobold', 14.5, 10.5, true).rest = 0;
    expect(count(run(w, 1), 'hurt')).toBe(0);
    expect(w.shots).toHaveLength(0);
  });

  it('backs away from a hero who closes in', () => {
    const w = quietArena();
    const k = spawnMonster(w, 'kobold', 12, 10, true);
    k.rest = 5;
    run(w, 0.5);
    expect(k.x).toBeGreaterThan(12.5);
  });
});

describe('an adder', () => {
  it('poisons with its bite: health drains and does not come back until the poison is spent', () => {
    const w = quietArena();
    const adder = spawnMonster(w, 'adder', 10.85, 10, true);
    adder.rest = 0;
    run(w, stats('adder').windup + 0.05);
    expect(w.hero.poison).toBeGreaterThan(stats('adder').poison! - 0.2);
    w.monsters.length = 0;
    const hp = w.hero.hp;
    run(w, 1);
    expect(w.hero.hp).toBeCloseTo(hp - POISON, 1);
    run(w, stats('adder').poison! + 1);
    expect(w.hero.poison).toBeLessThanOrEqual(0);
    expect(w.hero.hp).toBeGreaterThan(hp - POISON * stats('adder').poison!);
  });
});

describe('a gnoll', () => {
  it('strikes from a cell away, over the heads of the front rank', () => {
    const w = quietArena();
    const gnoll = spawnMonster(w, 'gnoll', 11.6, 10, true);
    gnoll.rest = 0;
    gnoll.x = 11.6;
    const reach = HERO.radius + stats('gnoll').reach;
    expect(far(gnoll, w)).toBeLessThan(reach);
    expect(far(gnoll, w)).toBeGreaterThan(HERO.radius + stats('goblin').reach);
    run(w, 0.25);
    expect(gnoll.wind).toBe(-1);
    expect(w.hero.hp).toBeLessThan(HERO.hp);
  });
});

describe('an ogre', () => {
  it('hits hard immediately after first contact', () => {
    const w = quietArena();
    const ogre = spawnMonster(w, 'ogre', 10.9, 10, true);
    ogre.rest = 0;
    run(w, 0.25);
    expect(ogre.wind).toBe(-1);
    expect(w.hero.hp).toBeLessThan(HERO.hp);

    const s = quietArena();
    spawnMonster(s, 'ogre', 10.9, 10, true).rest = 0;
    run(s, 0.25);
    expect(s.hero.hp).toBeCloseTo(HERO.hp - stats('ogre').damage, 0);
  });
});

describe('the throw', () => {
  it('is not made unless asked for', () => {
    const w = arena();
    spawnMonster(w, 'goblin', 15, 10, true).stun = 99;
    expect(count(run(w, 2), 'throw')).toBe(0);
  });

  it('flies to the target and hurts it', () => {
    const w = arena();
    const g = spawnMonster(w, 'goblin', 15, 10, true);
    g.stun = 99;
    stepWorld(w, { mx: 0, my: 0, throw: true });
    expect(count(w.events, 'throw')).toBe(1);
    expect(w.shots).toHaveLength(1);
    const events = run(w, 0.6);
    expect(events.filter((e) => e.type === 'hit')[0]).toMatchObject({ by: 'throw', amount: HERO.thrown.damage });
    expect(g.hp).toBe(stats('goblin').hp - HERO.thrown.damage);
    expect(w.shots).toHaveLength(0);
  });

  it('must wait before the next', () => {
    const w = arena();
    spawnMonster(w, 'goblin', 15, 10, true).hp = 9999;
    const throws = count(run(w, 5, { mx: 0, my: 0, throw: true }), 'throw');
    expect(throws).toBe(Math.floor(5 / HERO.thrown.every) + 1);
  });

  it('goes for one that throws before one that is nearer', () => {
    const w = arena();
    const goblin = spawnMonster(w, 'goblin', 12.5, 10, true);
    const kobold = spawnMonster(w, 'kobold', 10, 4, true);
    expect(throwTarget(w)).toBe(kobold);
    kobold.hp = 0;
    expect(throwTarget(w)).toBe(goblin);
  });

  it('goes for one that is awake before a sleeper, and for a sleeper only when nothing else is there', () => {
    const w = arena();
    const sleeper = spawnMonster(w, 'goblin', 10 + stats('goblin').notice + 0.5, 10, false);
    expect(throwTarget(w)).toBe(sleeper);
    const awake = spawnMonster(w, 'rat', 10, 3, true);
    expect(throwTarget(w)).toBe(awake);
  });

  it('has nothing to aim at out of range or out of sight', () => {
    const w = arena();
    spawnMonster(w, 'goblin', 10, 10 - HERO.thrown.range - 0.6, true).stun = 99;
    expect(throwTarget(w)).toBeUndefined();
    stepWorld(w, { mx: 0, my: 0, throw: true });
    expect(count(w.events, 'throw')).toBe(0);
    expect(w.hero.throwing).toBeLessThanOrEqual(0);
  });

  it('wakes the band of a sleeper it hits', () => {
    const w = arena();
    const a = spawnMonster(w, 'goblin', 10 + stats('goblin').notice + 0.5, 10, false, 77);
    const b = spawnMonster(w, 'goblin', 10 + stats('goblin').notice + 1.5, 11, false, 77);
    run(w, 0.8, { mx: 0, my: 0, throw: true });
    expect(a.awake).toBe(true);
    expect(b.awake).toBe(true);
  });
});

describe('the bands', () => {
  it('name only monsters that exist, on floors that exist', () => {
    for (const p of PACKS) {
      for (const member of p.members) expect(() => monsterKind(member.kind)).not.toThrow();
      expect(p.floors[0]).toBeGreaterThanOrEqual(1);
      expect(p.floors[1]).toBeLessThanOrEqual(DUNGEON.floors);
      expect(p.floors[0]).toBeLessThanOrEqual(p.floors[1]);
    }
  });

  it('bring every monster in somewhere, with ogres introduced at Dungeon 3', () => {
    const met = new Set(PACKS.flatMap((p) => p.members.map((m) => m.kind)));
    for (const m of MONSTERS) expect(met.has(m.id), m.id).toBe(true);
    for (const p of PACKS) if (!p.branch && p.members.some((m) => m.kind === 'ogre')) expect(p.floors[0]).toBe(3);
  });
});
