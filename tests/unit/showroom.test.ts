import { describe, expect, it } from 'vitest';
import { hasTile } from '../../src/data/tiles';
import { Cell, carve, cellAt, makeGrid, walkable } from '../../src/sim/grid';
import { cellNoise, makeRng } from '../../src/sim/rng';
import { makeShowroom } from '../../src/sim/showroom';

describe('a floor', () => {
  it('starts as solid wall and opens where carved', () => {
    const g = makeGrid(6, 5);
    expect(walkable(g, 2, 2)).toBe(false);
    carve(g, 1, 1, 3, 2);
    expect(walkable(g, 1, 1)).toBe(true);
    expect(walkable(g, 3, 2)).toBe(true);
    expect(walkable(g, 4, 2)).toBe(false);
  });

  it('counts everything off the floor as wall', () => {
    const g = makeGrid(3, 3, Cell.Floor);
    expect(cellAt(g, -1, 0)).toBe(Cell.Wall);
    expect(cellAt(g, 3, 1)).toBe(Cell.Wall);
    expect(cellAt(g, 1, 3)).toBe(Cell.Wall);
  });
});

describe('the random source', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = makeRng(7);
    const b = makeRng(7);
    const c = makeRng(8);
    const run = (r: () => number): number[] => Array.from({ length: 5 }, r);
    const first = run(a);
    expect(run(b)).toEqual(first);
    expect(run(c)).not.toEqual(first);
    for (const v of first) expect(v >= 0 && v < 1).toBe(true);
  });

  it('gives a cell the same number every time', () => {
    expect(cellNoise(3, 9)).toBe(cellNoise(3, 9));
    expect(cellNoise(3, 9)).not.toBe(cellNoise(9, 3));
    const seen = new Set<number>();
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) seen.add(Math.floor(cellNoise(x, y) * 8));
    expect(seen.size).toBe(8);
  });
});

describe('the room of stage 0', () => {
  const room = makeShowroom();

  it('stands everything on open floor', () => {
    for (const t of [room.hero, ...room.things]) {
      expect(cellAt(room.grid, Math.floor(t.x), Math.floor(t.y)), t.tile).toBe(Cell.Floor);
      expect(hasTile(t.tile), t.tile).toBe(true);
    }
  });

  it('puts nothing on top of anything else', () => {
    const cells = [room.hero, ...room.things].map((t) => `${Math.floor(t.x)},${Math.floor(t.y)}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('shows eight named monsters, a way down and a way up', () => {
    expect(room.things.filter((t) => t.label)).toHaveLength(8);
    expect([...room.grid.cells].filter((c) => c === Cell.StairsDown)).toHaveLength(1);
    expect([...room.grid.cells].filter((c) => c === Cell.StairsUp)).toHaveLength(1);
  });

  it('is walled all the way round except where a corridor runs off the edge', () => {
    const { w, h } = room.grid;
    const open: string[] = [];
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (walkable(room.grid, x, y)) open.push(`${x},${y}`);
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (walkable(room.grid, x, y)) open.push(`${x},${y}`);
    expect(open.sort()).toEqual(['0,22', '0,23', '24,22', '24,23']);
  });
});
