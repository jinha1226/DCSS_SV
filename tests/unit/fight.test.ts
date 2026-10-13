import { describe, expect, it } from 'vitest';
import { HERO } from '../../src/data/hero';
import { hornTrait } from '../../src/sim/traits';
import { monsterKind } from '../../src/data/monsters';
import { FAR, downhill, makeFlow, updateFlow } from '../../src/sim/flow';
import { Cell, carve, makeGrid, setCell } from '../../src/sim/grid';
import { spawnMonster } from '../../src/sim/monster';
import { effectValue } from '../../src/sim/skills';
import { STEP, makeWorld, stepWorld } from '../../src/sim/world';
import { STILL, arena, count, quietArena, run } from './arena';

const GOBLIN = monsterKind('goblin').stats;
/** The middle-to-middle distance at which a goblin stands touching the hero. */
const TOUCH = HERO.radius + GOBLIN.radius;

describe('the way to the hero', () => {
  it('counts steps round walls, not through them', () => {
    const g = makeGrid(9, 7);
    carve(g, 1, 1, 7, 5);
    for (let y = 1; y <= 4; y++) setCell(g, 4, y, Cell.Wall); // a wall with a gap at the bottom
    const flow = makeFlow(g);
    updateFlow(flow, g, 2, 2);
    expect(flow.dist[2 * 9 + 2]).toBe(0);
    expect(flow.dist[2 * 9 + 3]).toBe(1);
    expect(flow.dist[2 * 9 + 6]).toBe(10); // down to the gap, through, and back up
    expect(flow.dist[2 * 9 + 4]).toBe(FAR);
  });

  it('leads a monster round the wall', () => {
    const g = makeGrid(9, 7);
    carve(g, 1, 1, 7, 5);
    for (let y = 1; y <= 4; y++) setCell(g, 4, y, Cell.Wall);
    const flow = makeFlow(g);
    updateFlow(flow, g, 2, 2);
    const way = downhill(flow, g, 6.5, 2.5);
    expect(way && way.y).toBeGreaterThan(0.6); // downward, toward the gap
    expect(downhill(flow, g, 2.5, 2.5)).toBeUndefined();
  });
});

describe('a goblin', () => {
  it('stands until the hero comes into view, then closes in', () => {
    const w = arena();
    const g = spawnMonster(w, 'goblin', 10 + GOBLIN.notice - 1, 10, false);
    run(w, 0.8);
    expect(g.awake).toBe(true);
    expect(g.x).toBeLessThan(10 + GOBLIN.notice - 1);
    expect(g.facing).toBe(-1);
  });

  it('does not notice from beyond its range', () => {
    const grid = makeGrid(40, 6);
    carve(grid, 1, 1, 38, 4);
    const w = makeWorld({ floor: { grid, start: { x: 3, y: 3 }, rooms: [] }, monsters: false });
    const g = spawnMonster(w, 'goblin', 3 + GOBLIN.notice + 4, 3, false);
    run(w, 1);
    expect(g.awake).toBe(false);
    expect(g.x).toBe(3 + GOBLIN.notice + 4);
  });

  it('walks through a corridor one cell wide', () => {
    const grid = makeGrid(24, 7);
    carve(grid, 1, 1, 5, 5);
    carve(grid, 6, 3, 12, 1);
    carve(grid, 18, 1, 5, 5);
    const w = makeWorld({ floor: { grid, start: { x: 3.5, y: 3.5 }, rooms: [] }, monsters: false });
    w.hero.swing = w.hero.butt = 1e9;
    const g = spawnMonster(w, 'goblin', 20.5, 2.5, true);
    run(w, 6);
    expect(Math.hypot(g.x - w.hero.x, g.y - w.hero.y)).toBeLessThan(1.2);
  });

  it('waits for first contact, then strikes immediately without a windup', () => {
    const w = quietArena();
    const goblin = spawnMonster(w, 'goblin', 10 + TOUCH - 0.05, 10, true);
    goblin.rest = 0;
    expect(count(run(w, 0.18), 'hurt')).toBe(0);
    expect(goblin.wind).toBe(-1);
    expect(count(run(w, 0.05), 'hurt')).toBe(1);
    expect(w.hero.hp).toBeCloseTo(HERO.hp - GOBLIN.damage, 0);
  });

  it('lands a blow immediately before the hero can step away', () => {
    const w = quietArena();
    const goblin = spawnMonster(w, 'goblin', 10 + TOUCH - 0.05, 10, true);
    goblin.rest = 0;
    run(w, 0.2);
    expect(count(run(w, 0.05, { mx: -1, my: 0 }), 'hurt')).toBe(1);
    expect(w.hero.hp).toBeLessThan(HERO.hp);
  });

  it('rests between blows', () => {
    const w = quietArena();
    spawnMonster(w, 'goblin', 10 + TOUCH + 0.05, 10, true).rest = 0;
    const seconds = 3.5;
    expect(count(run(w, seconds), 'hurt')).toBeGreaterThanOrEqual(3);
  });
});

describe('the axe', () => {
  it('cuts everything in reach at once and nothing beyond', () => {
    const w = arena();
    w.hero.butt = 1e9;
    for (const [x, y] of [
      [11, 10],
      [9, 10],
      [10, 11.2],
      [10.9, 9.1],
    ] as const)
      spawnMonster(w, 'goblin', x, y, true);
    const out = spawnMonster(w, 'goblin', 10 + HERO.axe.reach + GOBLIN.radius + 0.3, 10, false);
    out.stun = 99;
    stepWorld(w, STILL);
    expect(count(w.events, 'swing')).toBe(1);
    expect(count(w.events, 'hit')).toBe(4);
    expect(out.hp).toBe(GOBLIN.hp);
    const axeDamage = Math.round(w.weapon.damage + effectValue(w, 'axe.damage'));
    for (const m of w.monsters) if (m !== out) expect(m.hp).toBe(GOBLIN.hp - axeDamage);
  });

  it('does not swing at empty air, and swings the moment something comes in reach', () => {
    const w = arena();
    w.hero.butt = 1e9;
    expect(count(run(w, 2), 'swing')).toBe(0);
    spawnMonster(w, 'goblin', 11, 10, true);
    stepWorld(w, STILL);
    expect(count(w.events, 'swing')).toBe(1);
  });

  it('swings no more often than its pace', () => {
    const w = arena();
    w.hero.butt = 1e9;
    const tough = spawnMonster(w, 'goblin', 11, 10, true);
    tough.hp = 9999;
    let swings = 0;
    for (let i = 0; i < Math.round(7 / STEP); i++) {
      tough.x = 11; // held in place: it stands and takes it
      tough.stun = 1;
      stepWorld(w, STILL);
      swings += count(w.events, 'swing');
    }
    expect(swings).toBeGreaterThanOrEqual(Math.floor(7 / HERO.axe.every));
    expect(swings).toBeLessThanOrEqual(Math.ceil(7 / HERO.axe.every) + 1);
  });

  it('nudges the struck back a little', () => {
    const w = arena();
    w.hero.butt = 1e9;
    const g = spawnMonster(w, 'goblin', 11, 10, true);
    g.stun = 99;
    stepWorld(w, STILL);
    w.hero.swing = 1e9;
    run(w, 0.5);
    expect(g.x).toBeGreaterThan(11.05);
    expect(g.x).toBeLessThan(11.3);
  });

  it('kills, counts the kill, and clears the body away', () => {
    const w = arena();
    w.hero.butt = 1e9;
    spawnMonster(w, 'goblin', 11, 10, true).stun = 99;
    const events = run(w, HERO.axe.every * Math.ceil(GOBLIN.hp / HERO.axe.damage));
    expect(count(events, 'kill')).toBe(1);
    expect(w.kills).toBe(1);
    expect(w.monsters).toHaveLength(0);
  });
});

describe('the horns', () => {
  it('butt the nearest monster that has closed in, throw it far and daze it', () => {
    const w = arena();
    w.hero.swing = 1e9;
    const near = spawnMonster(w, 'goblin', 10 + TOUCH + 0.05, 10, true);
    const other = spawnMonster(w, 'goblin', 10, 11.1, true);
    stepWorld(w, STILL);
    const hits = w.events.filter((e) => e.type === 'hit');
    expect(hits).toHaveLength(1);
    const horns = hornTrait(w)!;
    expect(hits[0]).toMatchObject({ by: 'horns', amount: horns.damage });
    expect(near.hp).toBe(GOBLIN.hp - hornTrait(w)!.damage);
    expect(other.hp).toBe(GOBLIN.hp);
    expect(near.stun).toBeGreaterThan(0);
    w.hero.butt = 1e9;
    run(w, 0.4);
    expect(near.x).toBeGreaterThan(11.4);
  });

  it('wait their turn', () => {
    const w = arena();
    w.hero.swing = 1e9;
    spawnMonster(w, 'goblin', 10 + TOUCH + 0.05, 10, true).hp = 9999;
    const butts = count(run(w, 6), 'hit');
    expect(butts).toBeGreaterThanOrEqual(2);
    expect(butts).toBeLessThanOrEqual(Math.ceil(6 / hornTrait(w)!.every));
  });
});

describe('a crowd', () => {
  it('keeps to one monster a cell: none stands on another, and none inside the hero', () => {
    const w = quietArena();
    for (let i = 0; i < 20; i++) spawnMonster(w, 'goblin', 15, 10, true).rest = 99;
    run(w, 4);
    let tightest = Infinity;
    for (const a of w.monsters) for (const b of w.monsters) if (a !== b) tightest = Math.min(tightest, Math.hypot(a.x - b.x, a.y - b.y));
    expect(tightest).toBeGreaterThan(GOBLIN.radius * 2 * 0.8);
    for (const m of w.monsters) expect(Math.hypot(m.x - w.hero.x, m.y - w.hero.y)).toBeGreaterThan(TOUCH - 0.12);
  });

  it('lets only a handful reach the hero at once', () => {
    const w = quietArena();
    for (let i = 0; i < 20; i++) spawnMonster(w, 'goblin', 10 + Math.cos(i) * 5, 10 + Math.sin(i) * 5, true).rest = 99;
    run(w, 4);
    const strike = HERO.radius + GOBLIN.reach;
    const inReach = w.monsters.filter((m) => Math.hypot(m.x - w.hero.x, m.y - w.hero.y) <= strike).length;
    expect(inReach).toBeGreaterThanOrEqual(4);
    expect(inReach).toBeLessThanOrEqual(8);
  });

  it('slows a hero who wades into it, but does not stop it dead', () => {
    const w = quietArena();
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) spawnMonster(w, 'goblin', 11 + i * 0.95, 8.1 + j * 0.95, true).stun = 99;
    const x0 = w.hero.x;
    run(w, 0.6, { mx: 1, my: 0 });
    const walked = w.hero.x - x0;
    expect(walked).toBeGreaterThan(0.35);
    expect(walked).toBeLessThan(HERO.speed * 0.6 * 0.8);
  });
});

describe('health', () => {
  it('comes back slowly by itself, up to full', () => {
    const w = arena();
    w.hero.hp = 30;
    run(w, 4);
    expect(w.hero.hp).toBeCloseTo(30 + HERO.regen * 4, 5);
    w.hero.hp = HERO.hp - 0.1;
    run(w, 2);
    expect(w.hero.hp).toBe(HERO.hp);
  });
});

describe('falling', () => {
  it('ends the run, and nothing moves after', () => {
    const w = quietArena();
    w.hero.hp = 1;
    spawnMonster(w, 'goblin', 10 + TOUCH + 0.05, 10, true).rest = 0;
    run(w, 1);
    expect(w.hero.hp).toBe(0);
    expect(w.over).toBe(true);
    expect(w.won).toBe(false);
    const time = w.time;
    run(w, 1, { mx: 1, my: 0 });
    expect(w.time).toBe(time);
    expect(w.hero.x).toBe(10);
  });
});
