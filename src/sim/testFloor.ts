import { Cell, carve, makeGrid, setCell } from './grid';
import type { Floor, Room } from './floor';

/**
 * A floor laid out by hand, kept for tests that need walls in known places: five rooms,
 * corridors two and three cells wide, and two rings to walk round.
 */
export function makeTestFloor(): Floor {
  const grid = makeGrid(40, 46);
  const rooms: Room[] = [
    { x: 4, y: 4, w: 11, h: 9 }, // A, top left: the start
    { x: 24, y: 3, w: 13, h: 9 }, // B, top right
    { x: 22, y: 20, w: 14, h: 12 }, // C, the hall on the right
    { x: 3, y: 22, w: 10, h: 9 }, // D, left
    { x: 14, y: 36, w: 9, h: 7 }, // E, bottom: the way down
  ];
  for (const r of rooms) carve(grid, r.x, r.y, r.w, r.h);

  carve(grid, 15, 6, 9, 3); // A to B, three wide
  carve(grid, 29, 12, 3, 8); // B to C, three wide
  carve(grid, 7, 13, 2, 9); // A to D, two wide
  carve(grid, 13, 25, 9, 2); // D to C, two wide: this closes the first ring
  carve(grid, 9, 31, 2, 9); // D down ...
  carve(grid, 9, 38, 5, 2); // ... and across to E
  carve(grid, 23, 38, 5, 3); // E across ...
  carve(grid, 25, 32, 3, 6); // ... and up to C: the second ring

  // Pillars in the hall, to walk round.
  for (const [x, y] of [
    [25, 23],
    [31, 23],
    [25, 28],
    [31, 28],
  ] as const) {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) setCell(grid, x + i, y + j, Cell.Wall);
  }
  // A single pillar, and a jutting piece of wall, to test corners.
  setCell(grid, 9, 8, Cell.Wall);
  setCell(grid, 30, 7, Cell.Wall);
  setCell(grid, 30, 8, Cell.Wall);
  setCell(grid, 31, 8, Cell.Wall);

  setCell(grid, 5, 5, Cell.StairsUp);
  setCell(grid, 18, 41, Cell.StairsDown);

  return { grid, start: { x: 6.5, y: 6.5 }, rooms };
}
