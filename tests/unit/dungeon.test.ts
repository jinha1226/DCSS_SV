import { describe, expect, it } from 'vitest';
import { HERO } from '../../src/data/hero';
import { DUNGEON } from '../../src/data/packs';
import { inRoom } from '../../src/sim/floor';
import { FAR, makeFlow, updateFlow } from '../../src/sim/flow';
import { GEN, makeFloor } from '../../src/sim/gen';
import { Cell, cellAt, walkable } from '../../src/sim/grid';
import { spawnMonster } from '../../src/sim/monster';
import { chooseReward } from '../../src/sim/rewards';
import { chooseSkill } from '../../src/sim/skills';
import { STEP, floorSeed, makeWorld, stepWorld, type World } from '../../src/sim/world';
import { STILL, arena, count, run } from './arena';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 13);

function cellsOf(floor: ReturnType<typeof makeFloor>, kind: Cell): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < floor.grid.h; y++) for (let x = 0; x < floor.grid.w; x++) if (cellAt(floor.grid, x, y) === kind) out.push({ x, y });
  return out;
}

describe('a generated floor', () => {
  it('is the same for the same seed and different for another', () => {
    const a = makeFloor(123);
    const b = makeFloor(123);
    expect([...a.grid.cells]).toEqual([...b.grid.cells]);
    expect(a.start).toEqual(b.start);
    expect([...makeFloor(124).grid.cells]).not.toEqual([...a.grid.cells]);
  });

  it('can be walked from the arrival to every open cell, whatever the seed', () => {
    for (const seed of SEEDS) {
      const floor = makeFloor(seed);
      const flow = makeFlow(floor.grid);
      updateFlow(flow, floor.grid, Math.floor(floor.start.x), Math.floor(floor.start.y));
      for (let i = 0; i < floor.grid.cells.length; i++) {
        if (floor.grid.cells[i] !== Cell.Wall) expect(flow.dist[i], `seed ${seed} cell ${i}`).not.toBe(FAR);
      }
    }
  });

  it('has one way up, where the hero arrives, and three ways down, each in its own room', () => {
    for (const seed of SEEDS) {
      const floor = makeFloor(seed);
      const up = cellsOf(floor, Cell.StairsUp);
      const down = cellsOf(floor, Cell.StairsDown);
      expect(up, `seed ${seed}`).toHaveLength(1);
      expect(down, `seed ${seed}`).toHaveLength(GEN.stairs);
      expect(floor.start).toEqual({ x: up[0]!.x + 0.5, y: up[0]!.y + 0.5 });
      expect(inRoom(floor.rooms[0]!, up[0]!.x, up[0]!.y)).toBe(true);
      const rooms = down.map((s) => floor.rooms.findIndex((r) => inRoom(r, s.x, s.y)));
      expect(new Set(rooms).size).toBe(GEN.stairs);
      expect(rooms).not.toContain(0);
    }
  });

  it('puts the ways down a good walk from the arrival', () => {
    let total = 0;
    for (const seed of SEEDS) {
      const floor = makeFloor(seed);
      const flow = makeFlow(floor.grid);
      updateFlow(flow, floor.grid, Math.floor(floor.start.x), Math.floor(floor.start.y));
      const nearest = Math.min(...cellsOf(floor, Cell.StairsDown).map((s) => flow.dist[s.y * floor.grid.w + s.x]!));
      expect(nearest, `seed ${seed}`).toBeGreaterThan(8);
      total += nearest;
    }
    expect(total / SEEDS.length).toBeGreaterThan(22);
  });

  it('has enough rooms, walls all round, and corridors of more than one width', () => {
    let narrow = 0;
    for (const seed of SEEDS) {
      const { grid, rooms } = makeFloor(seed);
      expect(rooms.length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      for (let i = 0; i < grid.w; i++)
        expect(walkable(grid, i, 0) || walkable(grid, i, grid.h - 1) || walkable(grid, 0, i) || walkable(grid, grid.w - 1, i)).toBe(false);
      for (let y = 1; y < grid.h - 1; y++) {
        for (let x = 1; x < grid.w - 1; x++) {
          if (walkable(grid, x, y) && !walkable(grid, x - 1, y) && !walkable(grid, x + 1, y)) narrow++;
        }
      }
    }
    expect(narrow).toBeGreaterThan(SEEDS.length * 5); // one-wide corridors do turn up
  });
});

describe('a floor full of bands', () => {
  const world = (seed: number, depth = 1): World => makeWorld({ seed, depth });

  it('has a sleeping band in every room but the one the hero arrives in', () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const w = world(seed);
      expect(w.monsters.length, `seed ${seed}`).toBeGreaterThan(12);
      expect(w.monsters.every((m) => !m.awake)).toBe(true);
      const own = w.rooms[0]!;
      for (const m of w.monsters) expect(inRoom(own, Math.floor(m.x), Math.floor(m.y))).toBe(false);
      for (let i = 1; i < w.rooms.length; i++) {
        expect(
          w.monsters.some((m) => inRoom(w.rooms[i]!, Math.floor(m.x), Math.floor(m.y))),
          `seed ${seed} room ${i}`,
        ).toBe(true);
      }
    }
  });

  it('stands no two monsters on one cell, and none in a wall', () => {
    for (const seed of SEEDS.slice(0, 12)) {
      const w = world(seed, 3);
      const cells = w.monsters.map((m) => `${Math.floor(m.x)},${Math.floor(m.y)}`);
      expect(new Set(cells).size).toBe(cells.length);
      for (const m of w.monsters) expect(walkable(w.grid, Math.floor(m.x), Math.floor(m.y))).toBe(true);
    }
  });

  it('is the same for the same seed', () => {
    const spots = (seed: number): string =>
      world(seed)
        .monsters.map((m) => `${m.kind.id}@${m.x},${m.y}`)
        .join(' ');
    expect(spots(5)).toBe(spots(5));
    expect(spots(5)).not.toBe(spots(6));
  });

  it('holds nothing on the first floor that belongs deeper, and brings the ogre on the last', () => {
    const first = new Set(SEEDS.slice(0, 12).flatMap((seed) => world(seed, 1).monsters.map((m) => m.kind.id)));
    expect(first.has('ogre')).toBe(false);
    expect(first.has('gnoll')).toBe(false);
    expect(first.has('adder')).toBe(false);
    const last = new Set(SEEDS.slice(0, 12).flatMap((seed) => world(seed, 3).monsters.map((m) => m.kind.id)));
    expect(last.has('ogre')).toBe(true);
    expect(last.has('rat')).toBe(false);
  });
});

describe('waking', () => {
  it('one of a band waking wakes the rest, and no other band', () => {
    const w = arena();
    w.hero.swing = w.hero.butt = 1e9;
    const a = spawnMonster(w, 'goblin', 14, 10, false, 5);
    const b = spawnMonster(w, 'goblin', 17, 16, false, 5);
    const other = spawnMonster(w, 'goblin', 17, 3, false, 6);
    a.x = 14;
    const events = run(w, 0.1);
    expect(a.awake && b.awake).toBe(true);
    expect(other.awake).toBe(false);
    expect(count(events, 'wake')).toBe(1);
  });

  it('a swing of the axe is heard by sleepers near by foot, not by those far off', () => {
    const w = makeWorld({ seed: 4, monsters: false });
    const hero = w.hero;
    const near = spawnMonster(w, 'adder', hero.x + 0.9, hero.y, true, 1);
    near.stun = 99;
    // A sleeper out of its own noticing range but within earshot, and one beyond earshot.
    const at = (steps: number): { x: number; y: number } => {
      for (let i = 0; i < w.flow.dist.length; i++)
        if (w.flow.dist[i] === steps) return { x: (i % w.grid.w) + 0.5, y: Math.floor(i / w.grid.w) + 0.5 };
      throw new Error(`no cell ${steps} steps away`);
    };
    const inEar = at(DUNGEON.loud - 1);
    const outOfEar = at(DUNGEON.loud + 6);
    const heard = spawnMonster(w, 'adder', inEar.x, inEar.y, false, 2);
    const deaf = spawnMonster(w, 'adder', outOfEar.x, outOfEar.y, false, 3);
    stepWorld(w, STILL);
    expect(count(w.events, 'swing')).toBe(1);
    expect(heard.awake).toBe(true);
    expect(deaf.awake).toBe(false);
  });
});

describe('lingering', () => {
  it('leaves a floor quiet at first, then sends bands up the stairs, sooner and sooner', () => {
    const w = makeWorld({ seed: 9, items: false });
    w.hero.maxHp = w.hero.hp = 1e9;
    const grow = (seconds: number): void => {
      for (let i = 0; i < Math.round(seconds / STEP); i++) {
        if (w.rewardChoices) chooseReward(w, w.rewardChoices[0]!.id);
        if (w.choosing) chooseSkill(w, w.choosing[0]!.id);
        stepWorld(w, STILL);
      }
    };
    const before = w.monsters.length;
    grow(DUNGEON.calm - 1);
    expect(w.monsters.length + w.kills).toBe(before);
    grow(2);
    const first = w.monsters.length + w.kills;
    expect(first).toBeGreaterThan(before);
    const arrivals: number[] = [];
    let seen = first;
    for (let i = 0; i < Math.round(150 / STEP); i++) {
      if (w.choosing) chooseSkill(w, w.choosing[0]!.id);
      stepWorld(w, STILL);
      if (w.monsters.length + w.kills > seen) {
        seen = w.monsters.length + w.kills;
        arrivals.push(w.floorTime);
      }
    }
    // Diagnostic when the progression simulation pauses unexpectedly.
    if (arrivals.length < 8)
      console.log('LINGERING_DEBUG', {
        time: w.time,
        floorTime: w.floorTime,
        pendingChoices: w.pendingChoices,
        rewardChoices: w.rewardChoices?.length,
        choosing: w.choosing?.length,
        pendingPickup: w.pendingPickup?.kind,
        over: w.over,
        monsters: w.monsters.length,
        kills: w.kills,
        nextBand: w.nextBand,
      });
    expect(arrivals.length).toBeGreaterThanOrEqual(8);
    const gaps = arrivals.slice(1).map((t, i) => t - arrivals[i]!);
    expect(gaps[gaps.length - 1]!).toBeLessThan(gaps[0]!);
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(DUNGEON.bandLeast - 0.1);
  });

  it('stops while the floor is already full', () => {
    const w = makeWorld({ seed: 9, monsters: false });
    w.hero.maxHp = w.hero.hp = 1e9;
    w.hero.swing = w.hero.butt = 1e9;
    w.nextBand = 0.1;
    for (let i = 0; i < DUNGEON.most; i++) spawnMonster(w, 'rat', w.hero.x, w.hero.y, false).stun = 1e9;
    for (const m of w.monsters) m.awake = true;
    run(w, 30);
    expect(w.monsters.length).toBe(DUNGEON.most);
  });
});

describe('the way down', () => {
  /** A world with the hero set on a way down. */
  function onStairs(depth: number): World {
    const w = makeWorld({ seed: 21, depth, monsters: false });
    const down = w.stairs.find((s) => s.down)!;
    w.hero.x = down.x + 0.5;
    w.hero.y = down.y + 0.5;
    return w;
  }

  it('is taken by standing on it a moment, not by running across', () => {
    const w = onStairs(1);
    run(w, DUNGEON.descend - 0.1);
    expect(w.depth).toBe(1);
    expect(w.descending).toBeGreaterThan(0);
    const across = onStairs(1);
    run(across, 0.2);
    across.hero.x += 3;
    run(across, 0.05);
    expect(across.descending).toBe(0);
    run(across, 2);
    expect(across.depth).toBe(1);
  });

  it('leads to the next floor: new ground, new bands, the hero by the way up, its wounds kept', () => {
    const w = makeWorld({ seed: 21 });
    const down = w.stairs.find((s) => s.down)!;
    w.monsters.length = 0;
    w.hero.x = down.x + 0.5;
    w.hero.y = down.y + 0.5;
    w.hero.hp = 33;
    const old = w.grid;
    const events = run(w, DUNGEON.descend + 0.05);
    expect(events.filter((e) => e.type === 'floor')[0]).toMatchObject({ depth: 2 });
    expect(w.depth).toBe(2);
    expect(w.grid).not.toBe(old);
    expect([...w.grid.cells]).toEqual([...makeFloor(floorSeed(21, 2)).grid.cells]);
    expect(cellAt(w.grid, Math.floor(w.hero.x), Math.floor(w.hero.y))).toBe(Cell.StairsUp);
    expect(w.hero.hp).toBeGreaterThanOrEqual(33);
    expect(w.hero.hp).toBeLessThan(34);
    expect(w.monsters.length).toBeGreaterThan(10);
    expect(w.floorTime).toBeLessThan(0.1);
    expect(w.time).toBeGreaterThan(DUNGEON.descend);
    expect(w.seen.some((v) => v === 1)).toBe(true);
  });

  it('does not award victory from a Dungeon 9 stair without completing Zot', () => {
    const w = onStairs(DUNGEON.floors);
    run(w, DUNGEON.descend + 0.05);
    expect(w.depth).toBe(701);
    expect(w.over).toBe(false);
    expect(w.won).toBe(false);
    expect(w.hero.hp).toBe(HERO.hp);
  });

  it('can start on a deeper floor', () => {
    expect(makeWorld({ seed: 2, depth: 3 }).depth).toBe(3);
    expect(makeWorld({ seed: 2, depth: 99 }).depth).toBe(DUNGEON.floors);
  });
});
