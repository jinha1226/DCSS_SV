import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../../src/data/packs';
import { Cell } from '../../src/sim/grid';
import { makeWorld, STEP, stepWorld, type World } from '../../src/sim/world';

const IDLE = { mx: 0, my: 0 };

function ticks(w: World, seconds: number): void {
  for (let i = 0; i < Math.ceil(seconds / STEP); i++) stepWorld(w, IDLE);
}

function leaveStairs(w: World): void {
  const index = w.grid.cells.indexOf(Cell.Floor);
  expect(index).toBeGreaterThanOrEqual(0);
  w.hero.x = (index % w.grid.w) + 0.5;
  w.hero.y = Math.floor(index / w.grid.w) + 0.5;
  stepWorld(w, IDLE);
  expect(w.stairsArmed).toBe(true);
}

function take(w: World, down: boolean, index = 0): void {
  leaveStairs(w);
  const stair = w.stairs.filter((s) => s.down === down)[index]!;
  expect(stair).toBeDefined();
  w.hero.x = stair.x + 0.5;
  w.hero.y = stair.y + 0.5;
  ticks(w, DUNGEON.descend + STEP);
}

describe('stage 2: paired stairs and re-entry', () => {
  it('never bounces off the destination stair, even after several seconds', () => {
    const w = makeWorld({ seed: 21, monsters: false, items: false });
    take(w, true);
    expect(w.depth).toBe(2);
    expect(w.stairsArmed).toBe(false);
    ticks(w, 3);
    expect(w.depth).toBe(2);
    expect(w.descending).toBe(0);
  });

  it('returns to the exact down stair used, including a different entrance', () => {
    const w = makeWorld({ seed: 21, monsters: false, items: false });
    for (const index of [0, 2]) {
      const stair = w.stairs.filter((s) => s.down)[index]!;
      take(w, true, index);
      expect(w.depth).toBe(2);
      take(w, false);
      expect(w.depth).toBe(1);
      expect(w.hero.x).toBe(stair.x + 0.5);
      expect(w.hero.y).toBe(stair.y + 0.5);
    }
  });

  it('supports starting directly in depth 2 and climbing to a valid parent stair', () => {
    const w = makeWorld({ seed: 12, depth: 2, monsters: false, items: false });
    take(w, false);
    expect(w.depth).toBe(1);
    const cell = w.grid.cells[Math.floor(w.hero.y) * w.grid.w + Math.floor(w.hero.x)];
    expect(cell).toBe(Cell.StairsDown);
    ticks(w, 2);
    expect(w.depth).toBe(1);
  });

  it('can repeat a round trip 100 times without changing depth or destination', () => {
    const w = makeWorld({ seed: 33, monsters: false, items: false });
    const source = w.stairs.filter((s) => s.down)[1]!;
    const parentItem = { uid: 'parent-token', kind: 'ammo' as const, x: 1.5, y: 1.5, count: 1, ignored: false };
    const childItem = { uid: 'child-token', kind: 'ammo' as const, x: 1.5, y: 1.5, count: 1, ignored: false };
    w.groundItems.push(parentItem);
    let previousTime = 0;
    for (let i = 0; i < 100; i++) {
      take(w, true, 1);
      expect(w.depth).toBe(2);
      if (i === 0) w.groundItems.push(childItem);
      expect(w.groundItems).toEqual([childItem]);
      take(w, false);
      expect(w.depth).toBe(1);
      expect(w.hero.x).toBe(source.x + 0.5);
      expect(w.hero.y).toBe(source.y + 0.5);
      expect(w.groundItems).toEqual([parentItem]);
      expect(w.floorTime).toBeGreaterThan(previousTime);
      previousTime = w.floorTime;
    }
    expect(w.floorStates.size).toBe(2);
    expect(w.stairConnections.size).toBe(1);
  });
});
