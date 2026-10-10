import { describe, expect, it } from 'vitest';
import { moveCircle, wallGap, type Point } from '../../src/sim/collide';
import { Cell, carve, cellAt, makeGrid, setCell, walkable } from '../../src/sim/grid';
import { makeRng } from '../../src/sim/rng';
import { makeTestFloor } from '../../src/sim/testFloor';
import { HERO } from '../../src/data/hero';
import { STEP, makeWorld, stepWorld } from '../../src/sim/world';

const R = 0.35;

/** A 12 by 12 floor, open from 1 to 10 each way. */
function openRoom() {
  const g = makeGrid(12, 12);
  carve(g, 1, 1, 10, 10);
  return g;
}

function walk(g: ReturnType<typeof makeGrid>, from: Point, dx: number, dy: number, steps: number): Point {
  let p = from;
  for (let i = 0; i < steps; i++) p = moveCircle(g, p, R, dx, dy);
  return p;
}

describe('walking into walls', () => {
  it('moves freely in the open', () => {
    const p = moveCircle(openRoom(), { x: 5, y: 5 }, R, 0.3, -0.2);
    expect(p.x).toBeCloseTo(5.3);
    expect(p.y).toBeCloseTo(4.8);
  });

  it('stops a radius short of a wall', () => {
    const p = walk(openRoom(), { x: 5, y: 5 }, 0, -0.075, 200);
    expect(p.y).toBeCloseTo(1 + R);
    expect(p.x).toBeCloseTo(5);
  });

  it('slides along a wall at full sideways speed, with no catch at the seams between cells', () => {
    const g = openRoom();
    let p = walk(g, { x: 2, y: 2 }, 0, -0.075, 40);
    for (let i = 0; i < 80; i++) {
      const next = moveCircle(g, p, R, 0.05, -0.05);
      expect(next.x - p.x).toBeCloseTo(0.05, 9);
      expect(next.y).toBeCloseTo(1 + R, 9);
      p = next;
    }
  });

  it('rounds a corner instead of catching on it', () => {
    // A corridor two wide (x 5..6) opens north out of the room; the hero walks straight up, a
    // little too far to the left to fit, and is eased into the opening.
    const g = makeGrid(12, 12);
    carve(g, 1, 6, 10, 5);
    carve(g, 5, 1, 2, 5);
    const p = walk(g, { x: 5.1, y: 9 }, 0, -0.075, 120);
    expect(p.y).toBeLessThan(3);
    expect(p.x).toBeGreaterThanOrEqual(5 + R - 1e-9);
  });

  it('is stopped dead by a flat wall it cannot round', () => {
    const g = openRoom();
    setCell(g, 5, 4, Cell.Wall);
    const p = walk(g, { x: 5.5, y: 8 }, 0, -0.075, 200);
    expect(p.y).toBeCloseTo(5 + R);
    expect(p.x).toBeCloseTo(5.5);
  });

  it('does not pass through a wall however large the step', () => {
    const p = moveCircle(openRoom(), { x: 5, y: 5 }, R, 30, 0);
    expect(p.x).toBeCloseTo(11 - R);
  });

  it('never ends up inside a wall, whatever is pressed', () => {
    const { grid, start } = makeTestFloor();
    const rng = makeRng(11);
    let p: Point = start;
    let angle = 0;
    for (let i = 0; i < 30000; i++) {
      if (i % 45 === 0) angle = rng() * Math.PI * 2;
      p = moveCircle(grid, p, R, Math.cos(angle) * 0.075, Math.sin(angle) * 0.075);
      expect(walkable(grid, Math.floor(p.x), Math.floor(p.y))).toBe(true);
      expect(wallGap(grid, p)).toBeGreaterThan(R - 1e-6);
    }
  });
});

describe('the floor of stage 1', () => {
  const { grid, start } = makeTestFloor();

  it('can be walked from the start to every open cell', () => {
    const reached = new Uint8Array(grid.w * grid.h);
    const queue = [[Math.floor(start.x), Math.floor(start.y)] as const];
    reached[queue[0]![1] * grid.w + queue[0]![0]] = 1;
    while (queue.length) {
      const [x, y] = queue.pop()!;
      for (const [i, j] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (!walkable(grid, i, j) || reached[j * grid.w + i]) continue;
        reached[j * grid.w + i] = 1;
        queue.push([i, j]);
      }
    }
    let open = 0;
    let got = 0;
    for (let i = 0; i < grid.cells.length; i++) {
      if (grid.cells[i] !== Cell.Wall) open++;
      if (reached[i]) got++;
    }
    expect(got).toBe(open);
    expect(open).toBeGreaterThan(500);
  });

  it('has one way up and one way down, and is walled all round', () => {
    expect([...grid.cells].filter((c) => c === Cell.StairsDown)).toHaveLength(1);
    expect([...grid.cells].filter((c) => c === Cell.StairsUp)).toHaveLength(1);
    for (let x = 0; x < grid.w; x++) expect(walkable(grid, x, 0) || walkable(grid, x, grid.h - 1)).toBe(false);
    for (let y = 0; y < grid.h; y++) expect(walkable(grid, 0, y) || walkable(grid, grid.w - 1, y)).toBe(false);
  });

  it('has no corridor a single cell wide', () => {
    // An open cell with wall on both sides, left and right or above and below, is a one-wide passage.
    for (let y = 1; y < grid.h - 1; y++) {
      for (let x = 1; x < grid.w - 1; x++) {
        if (!walkable(grid, x, y)) continue;
        const squeezedX = !walkable(grid, x - 1, y) && !walkable(grid, x + 1, y);
        const squeezedY = !walkable(grid, x, y - 1) && !walkable(grid, x, y + 1);
        expect(squeezedX || squeezedY, `${x},${y}`).toBe(false);
      }
    }
  });
});

describe('the hero', () => {
  it('walks at its speed, and no faster on the diagonal', () => {
    const w = makeWorld(makeTestFloor(), { monsters: false });
    const x0 = w.hero.x;
    for (let i = 0; i < 60; i++) stepWorld(w, { mx: 1, my: 0 });
    expect(w.hero.x - x0).toBeCloseTo(HERO.speed, 6);
    expect(w.time).toBeCloseTo(60 * STEP);

    const d = makeWorld(makeTestFloor(), { monsters: false });
    const from = { x: d.hero.x, y: d.hero.y };
    for (let i = 0; i < 20; i++) stepWorld(d, { mx: 1, my: 1 });
    expect(Math.hypot(d.hero.x - from.x, d.hero.y - from.y)).toBeCloseTo((HERO.speed * 20) / 60, 6);
  });

  it('walks slower when the stick is pushed part way', () => {
    const w = makeWorld(makeTestFloor(), { monsters: false });
    const x0 = w.hero.x;
    for (let i = 0; i < 60; i++) stepWorld(w, { mx: 0.5, my: 0 });
    expect(w.hero.x - x0).toBeCloseTo(HERO.speed / 2, 6);
  });

  it('turns to face the way it walks and keeps facing that way when it stops', () => {
    const w = makeWorld(makeTestFloor(), { monsters: false });
    stepWorld(w, { mx: 1, my: 0 });
    expect(w.hero.facing).toBe(1);
    expect(w.hero.moving).toBe(true);
    stepWorld(w, { mx: 0, my: 0 });
    expect(w.hero.facing).toBe(1);
    expect(w.hero.moving).toBe(false);
    stepWorld(w, { mx: -1, my: 0.2 });
    expect(w.hero.facing).toBe(-1);
    stepWorld(w, { mx: 0, my: 1 });
    expect(w.hero.facing).toBe(-1);
  });

  it('remembers where it was a step ago', () => {
    const w = makeWorld(makeTestFloor(), { monsters: false });
    stepWorld(w, { mx: 1, my: 0 });
    const x1 = w.hero.x;
    stepWorld(w, { mx: 1, my: 0 });
    expect(w.hero.px).toBe(x1);
    expect(cellAt(w.grid, Math.floor(w.hero.x), Math.floor(w.hero.y))).not.toBe(Cell.Wall);
  });
});
