import { describe, expect, it } from 'vitest';
import { HERO } from '../../src/data/hero';
import { monsterKind } from '../../src/data/monsters';
import { FAR, downhill, makeFlow, updateFlow } from '../../src/sim/flow';
import { Cell, carve, makeGrid, setCell } from '../../src/sim/grid';
import { spawnMonster } from '../../src/sim/monster';
import { makeTestFloor, type Floor } from '../../src/sim/testFloor';
import { WAVES } from '../../src/sim/waves';
import { STEP, makeWorld, stepWorld, type SimEvent, type World } from '../../src/sim/world';

const GOBLIN = monsterKind('goblin').stats;
const STILL = { mx: 0, my: 0 };

/** One open room, 18 by 18, the hero in the middle and nothing else in it. */
function arena(): World {
  const grid = makeGrid(20, 20);
  carve(grid, 1, 1, 18, 18);
  const floor: Floor = { grid, start: { x: 10, y: 10 }, rooms: [{ x: 1, y: 1, w: 18, h: 18 }] };
  return makeWorld(floor, { monsters: false });
}

/** Steps the world for `seconds`, gathering what happened. */
function run(w: World, seconds: number, input = STILL): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    stepWorld(w, input);
    events.push(...w.events);
  }
  return events;
}

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
    const far = spawnMonster(w, 'goblin', 10, 2, true);
    far.awake = false;
    w.monsters.length = 0;
    const g = spawnMonster(w, 'goblin', 16, 10, false);
    run(w, 0.5);
    expect(g.awake).toBe(true);
    expect(g.x).toBeLessThan(16);
    expect(g.facing).toBe(-1);
  });

  it('does not notice from beyond its range', () => {
    const grid = makeGrid(40, 6);
    carve(grid, 1, 1, 38, 4);
    const w = makeWorld({ grid, start: { x: 3, y: 3 }, rooms: [] }, { monsters: false });
    const g = spawnMonster(w, 'goblin', 3 + GOBLIN.notice + 4, 3, false);
    run(w, 1);
    expect(g.awake).toBe(false);
    expect(g.x).toBe(3 + GOBLIN.notice + 4);
  });

  it('draws back before it strikes, and the blow lands on a hero who stays', () => {
    const w = arena();
    w.hero.swing = w.hero.butt = 99; // the hero holds its blows
    spawnMonster(w, 'goblin', 10.8, 10, true).rest = 0;
    const early = run(w, GOBLIN.windup - 0.05);
    expect(early.some((e) => e.type === 'hurt')).toBe(false);
    const late = run(w, 0.15);
    expect(late.filter((e) => e.type === 'hurt')).toHaveLength(1);
    expect(w.hero.hp).toBeCloseTo(HERO.hp - GOBLIN.damage, 0);
  });

  it('misses a hero who steps away while it draws back', () => {
    const w = arena();
    w.hero.swing = w.hero.butt = 99;
    spawnMonster(w, 'goblin', 10.8, 10, true).rest = 0;
    run(w, 0.05);
    const events = run(w, GOBLIN.windup + 0.1, { mx: -1, my: 0 });
    expect(events.some((e) => e.type === 'hurt')).toBe(false);
    expect(w.hero.hp).toBe(HERO.hp);
  });

  it('rests between blows', () => {
    const w = arena();
    w.hero.swing = w.hero.butt = 99;
    spawnMonster(w, 'goblin', 10.8, 10, true).rest = 0;
    const seconds = 3.5;
    const hurts = run(w, seconds).filter((e) => e.type === 'hurt').length;
    expect(hurts).toBe(Math.floor((seconds - GOBLIN.windup) / (GOBLIN.windup + GOBLIN.rest)) + 1);
  });
});

describe('the axe', () => {
  it('cuts everything in reach at once and nothing beyond', () => {
    const w = arena();
    w.hero.butt = 99;
    for (const [x, y] of [[11, 10], [9, 10], [10, 11.2], [10.9, 9.1]] as const) spawnMonster(w, 'goblin', x, y, true);
    const out = spawnMonster(w, 'goblin', 10 + HERO.axe.reach + 0.6, 12.5, false);
    stepWorld(w, STILL);
    expect(w.events.filter((e) => e.type === 'swing')).toHaveLength(1);
    expect(w.events.filter((e) => e.type === 'hit')).toHaveLength(4);
    expect(out.hp).toBe(GOBLIN.hp);
    for (const m of w.monsters) if (m !== out) expect(m.hp).toBe(GOBLIN.hp - HERO.axe.damage);
  });

  it('does not swing at empty air, and swings the moment something comes in reach', () => {
    const w = arena();
    w.hero.butt = 99;
    expect(run(w, 2).some((e) => e.type === 'swing')).toBe(false);
    spawnMonster(w, 'goblin', 11, 10, true);
    stepWorld(w, STILL);
    expect(w.events.some((e) => e.type === 'swing')).toBe(true);
  });

  it('swings no more often than its pace', () => {
    const w = arena();
    w.hero.butt = 99;
    const tough = spawnMonster(w, 'goblin', 11, 10, true);
    tough.hp = 9999;
    let swings = 0;
    for (let i = 0; i < Math.round(7 / STEP); i++) {
      tough.x = 11; // held in place: it stands and takes it
      tough.stun = 1;
      stepWorld(w, STILL);
      swings += w.events.filter((e) => e.type === 'swing').length;
    }
    expect(swings).toBeGreaterThanOrEqual(Math.floor(7 / HERO.axe.every));
    expect(swings).toBeLessThanOrEqual(Math.ceil(7 / HERO.axe.every) + 1);
  });

  it('throws the struck back a little way', () => {
    const w = arena();
    w.hero.butt = 99;
    const g = spawnMonster(w, 'goblin', 11, 10, true);
    g.stun = 99;
    stepWorld(w, STILL);
    w.hero.swing = 99;
    run(w, 0.5);
    expect(g.x).toBeGreaterThan(11.05);
    expect(g.x).toBeLessThan(11.3);
  });

  it('kills, counts the kill, and clears the body away', () => {
    const w = arena();
    w.hero.butt = 99;
    const g = spawnMonster(w, 'goblin', 11, 10, true);
    g.stun = 99;
    const events = run(w, HERO.axe.every * Math.ceil(GOBLIN.hp / HERO.axe.damage));
    expect(events.filter((e) => e.type === 'kill')).toHaveLength(1);
    expect(w.kills).toBe(1);
    expect(w.monsters).toHaveLength(0);
  });
});

describe('the horns', () => {
  it('butt the nearest monster that has closed in, throw it far and daze it', () => {
    const w = arena();
    w.hero.swing = 99;
    const near = spawnMonster(w, 'goblin', 10.8, 10, true);
    const other = spawnMonster(w, 'goblin', 10, 11, true);
    stepWorld(w, STILL);
    const hits = w.events.filter((e) => e.type === 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ by: 'horns', amount: HERO.horns.damage });
    expect(near.hp).toBe(GOBLIN.hp - HERO.horns.damage);
    expect(other.hp).toBe(GOBLIN.hp);
    expect(near.stun).toBeGreaterThan(0);
    w.hero.butt = 99;
    run(w, 0.4);
    expect(near.x).toBeGreaterThan(11.4);
  });

  it('wait their turn', () => {
    const w = arena();
    w.hero.swing = 99;
    const g = spawnMonster(w, 'goblin', 10.8, 10, true);
    g.hp = 9999;
    const butts = run(w, 6).filter((e) => e.type === 'hit').length;
    expect(butts).toBeGreaterThanOrEqual(2);
    expect(butts).toBeLessThanOrEqual(Math.ceil(6 / HERO.horns.every));
  });
});

describe('a crowd', () => {
  it('does not stand on one spot', () => {
    const w = arena();
    w.hero.swing = w.hero.butt = 99;
    for (let i = 0; i < 20; i++) spawnMonster(w, 'goblin', 15, 10, true).rest = 99;
    run(w, 3);
    let tightest = Infinity;
    for (const a of w.monsters) for (const b of w.monsters) if (a !== b) tightest = Math.min(tightest, Math.hypot(a.x - b.x, a.y - b.y));
    expect(tightest).toBeGreaterThan(GOBLIN.radius * 2 * 0.6);
    // And none is inside the hero.
    for (const m of w.monsters) expect(Math.hypot(m.x - w.hero.x, m.y - w.hero.y)).toBeGreaterThan(HERO.radius + GOBLIN.radius - 0.12);
  });

  it('slows a hero who wades into it, but does not stop it dead', () => {
    const w = arena();
    w.hero.swing = w.hero.butt = 99;
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) spawnMonster(w, 'goblin', 11 + i * 0.6, 8.8 + j * 0.6, true).stun = 99;
    const x0 = w.hero.x;
    run(w, 0.6, { mx: 1, my: 0 });
    const walked = w.hero.x - x0;
    expect(walked).toBeGreaterThan(0.6);
    expect(walked).toBeLessThan(HERO.speed * 0.6 * 0.9);
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
    const w = arena();
    w.hero.swing = w.hero.butt = 99;
    w.hero.hp = 1;
    const g = spawnMonster(w, 'goblin', 10.8, 10, true);
    g.rest = 0;
    run(w, 1);
    expect(w.hero.hp).toBe(0);
    expect(w.over).toBe(true);
    const time = w.time;
    run(w, 1, { mx: 1, my: 0 });
    expect(w.time).toBe(time);
    expect(w.hero.x).toBe(10);
  });
});

describe('the floor of stage 2', () => {
  it('starts with bands in every room but the hero\'s own, all unaware', () => {
    const w = makeWorld(makeTestFloor(), { seed: 3 });
    expect(w.monsters).toHaveLength(WAVES.rooms.reduce<number>((a, b) => a + b, 0));
    expect(w.monsters.every((m) => !m.awake)).toBe(true);
    const own = w.rooms[0]!;
    for (const m of w.monsters) expect(m.x > own.x && m.x < own.x + own.w && m.y > own.y && m.y < own.y + own.h).toBe(false);
  });

  it('is the same for the same seed', () => {
    const spots = (seed: number): string => makeWorld(makeTestFloor(), { seed }).monsters.map((m) => `${m.x},${m.y}`).join(' ');
    expect(spots(5)).toBe(spots(5));
    expect(spots(5)).not.toBe(spots(6));
  });

  it('sends a band, awake, when the time comes', () => {
    const w = makeWorld(makeTestFloor(), { seed: 3 });
    const before = w.monsters.length;
    run(w, WAVES.first + 0.1);
    expect(w.monsters.length).toBe(before + WAVES.size);
    expect(w.monsters.filter((m) => m.awake).length).toBeGreaterThanOrEqual(WAVES.size);
  });
});
