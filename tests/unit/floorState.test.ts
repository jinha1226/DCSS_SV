import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../../src/data/packs';
import { Cell } from '../../src/sim/grid';
import { spawnMonster } from '../../src/sim/monster';
import { makeWorld, STEP, stepWorld, type World } from '../../src/sim/world';

const STILL = { mx: 0, my: 0 };

function wait(w: World): void {
  for (let i = 0; i < Math.ceil((DUNGEON.descend + STEP) / STEP); i++) stepWorld(w, STILL);
}

function take(w: World, down: boolean): void {
  const free = w.grid.cells.indexOf(Cell.Floor);
  w.hero.x = (free % w.grid.w) + 0.5;
  w.hero.y = Math.floor(free / w.grid.w) + 0.5;
  stepWorld(w, STILL);
  const stair = w.stairs.find((s) => s.down === down)!;
  w.hero.x = stair.x + 0.5;
  w.hero.y = stair.y + 0.5;
  wait(w);
}

describe('stage 2: persistent floor state', () => {
  it('restores monsters, ground items, exploration, timers and per-floor abilities', () => {
    const w = makeWorld({ seed: 71, monsters: false, items: false });
    const originalGrid = w.grid;
    const marker = w.stairs.filter((s) => s.down)[2]!;
    const monster = spawnMonster(w, 'rat', marker.x + 0.5, marker.y + 0.5, false);
    monster.hp = 1;
    monster.stun = 999;
    const item = { uid: 'persist-test', kind: 'ammo' as const, x: marker.x + 0.5, y: marker.y + 0.5, count: 3, ignored: false };
    w.groundItems.push(item);
    const explored = w.grid.cells.indexOf(Cell.Floor);
    w.seen[explored] = 1;
    w.floorTime = 17;
    w.nextBand = 13;
    w.hero.lastStandUsed = true;

    take(w, true);
    expect(w.depth).toBe(2);
    const storedBand = w.floorStates.get(1)!.nextBand;
    expect(w.hero.lastStandUsed).toBe(false);
    const secondGrid = w.grid;
    const secondItem = { uid: 'other-floor', kind: 'ammo' as const, x: 1.5, y: 1.5, count: 1, ignored: false };
    w.groundItems.push(secondItem);
    w.hero.lastStandUsed = true;
    take(w, false);
    expect(w.depth).toBe(1);
    expect(w.grid).toBe(originalGrid);
    expect(w.monsters).toContain(monster);
    expect(monster.hp).toBe(1);
    expect(w.groundItems).toContain(item);
    expect(w.groundItems).not.toContain(secondItem);
    expect(w.seen[explored]).toBe(1);
    expect(w.floorTime).toBeGreaterThanOrEqual(17);
    expect(w.nextBand).toBeCloseTo(storedBand);
    expect(w.hero.lastStandUsed).toBe(true);

    take(w, true);
    expect(w.grid).toBe(secondGrid);
    expect(w.groundItems).toContain(secondItem);
    expect(w.groundItems).not.toContain(item);
    expect(w.hero.lastStandUsed).toBe(true);
    expect(w.floorStates.size).toBe(2);
  });

  it('keeps random streams separate on returning to the original floor', () => {
    const a = makeWorld({ seed: 89, monsters: false, items: false });
    const reference = makeWorld({ seed: 89, monsters: false, items: false });
    expect(a.rng()).toBe(reference.rng());
    take(a, true);
    for (let i = 0; i < 25; i++) a.rng();
    take(a, false);
    expect(a.rng()).toBe(reference.rng());
  });
});
