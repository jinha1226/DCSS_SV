import { describe, expect, it } from 'vitest';
import { computeFov } from '../../src/sim/fov';
import { Cell, carve, makeGrid, setCell } from '../../src/sim/grid';
import { makeTestFloor } from '../../src/sim/testFloor';
import { makeWorld, stepWorld } from '../../src/sim/world';

function see(g: ReturnType<typeof makeGrid>, x: number, y: number, radius = 20): (x: number, y: number) => boolean {
  const out = new Uint8Array(g.w * g.h);
  computeFov(g, x, y, radius, out);
  return (i, j) => out[j * g.w + i] === 1;
}

describe('sight', () => {
  it('takes in a whole open room and the walls round it', () => {
    const g = makeGrid(12, 10);
    carve(g, 1, 1, 10, 8);
    const seen = see(g, 4, 5);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 12; x++) expect(seen(x, y), `${x},${y}`).toBe(true);
  });

  it('does not pass through a wall', () => {
    // Two rooms side by side with a solid wall between them at x = 6.
    const g = makeGrid(13, 9);
    carve(g, 1, 1, 5, 7);
    carve(g, 7, 1, 5, 7);
    const seen = see(g, 3, 4);
    expect(seen(6, 4)).toBe(true);
    for (let y = 1; y < 8; y++) for (let x = 7; x < 12; x++) expect(seen(x, y), `${x},${y}`).toBe(false);
  });

  it('sees through a doorway only what lies in line with it', () => {
    const g = makeGrid(13, 9);
    carve(g, 1, 1, 5, 7);
    carve(g, 7, 1, 5, 7);
    setCell(g, 6, 4, Cell.Floor);
    const seen = see(g, 2, 4);
    expect(seen(9, 4)).toBe(true);
    expect(seen(11, 4)).toBe(true);
    expect(seen(7, 1)).toBe(false);
    expect(seen(7, 7)).toBe(false);
  });

  it('hides what is behind a pillar and shows what is beside it', () => {
    const g = makeGrid(15, 9);
    carve(g, 1, 1, 13, 7);
    setCell(g, 6, 4, Cell.Wall);
    const seen = see(g, 3, 4);
    expect(seen(6, 4)).toBe(true);
    expect(seen(8, 4)).toBe(false);
    expect(seen(12, 4)).toBe(false);
    expect(seen(8, 1)).toBe(true);
    expect(seen(8, 7)).toBe(true);
  });

  it('reaches no farther than its radius', () => {
    const g = makeGrid(30, 5);
    carve(g, 1, 1, 28, 3);
    const seen = see(g, 2, 2, 6);
    expect(seen(8, 2)).toBe(true);
    expect(seen(10, 2)).toBe(false);
  });

  it('is the same in every direction', () => {
    const g = makeGrid(21, 21);
    carve(g, 1, 1, 19, 19);
    setCell(g, 13, 10, Cell.Wall);
    setCell(g, 7, 10, Cell.Wall);
    setCell(g, 10, 13, Cell.Wall);
    setCell(g, 10, 7, Cell.Wall);
    const seen = see(g, 10, 10);
    for (let d = 1; d < 9; d++) {
      const east = seen(10 + d, 10);
      expect(seen(10 - d, 10)).toBe(east);
      expect(seen(10, 10 + d)).toBe(east);
      expect(seen(10, 10 - d)).toBe(east);
    }
  });
});

describe('what the hero has seen', () => {
  it('starts with its own room and grows as it walks', () => {
    const w = makeWorld(makeTestFloor(), { monsters: false });
    const count = (a: Uint8Array): number => a.reduce((n, v) => n + v, 0);
    const first = count(w.seen);
    expect(first).toBeGreaterThan(90);
    expect(w.seen[25 * w.grid.w + 28]).toBe(0); // the hall is out of sight

    for (let i = 0; i < 400; i++) stepWorld(w, { mx: 1, my: 0 }); // along the corridor into room B
    expect(count(w.seen)).toBeGreaterThan(first);
    for (let i = 0; i < w.seen.length; i++) if (w.visible[i]) expect(w.seen[i]).toBe(1);
    // The start room is remembered though no longer all in sight.
    expect(w.seen[10 * w.grid.w + 5]).toBe(1);
  });
});
