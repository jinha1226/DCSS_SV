import { Cell, carve, makeGrid, setCell, type Grid } from './grid';
import type { Point } from './collide';

export interface Floor {
  readonly grid: Grid;
  /** Where the hero arrives, in cells (the middle of a cell). */
  readonly start: Point;
}

/**
 * The floor of stage 1, laid out by hand: five rooms, corridors two and three cells wide, and
 * two rings to walk round. Generated floors replace it in stage 3.
 */
export function makeTestFloor(): Floor {
  const grid = makeGrid(40, 46);

  carve(grid, 4, 4, 11, 9); // A, top left: the start
  carve(grid, 24, 3, 13, 9); // B, top right
  carve(grid, 22, 20, 14, 12); // C, the hall on the right
  carve(grid, 3, 22, 10, 9); // D, left
  carve(grid, 14, 36, 9, 7); // E, bottom: the way down

  carve(grid, 15, 6, 9, 3); // A to B, three wide
  carve(grid, 29, 12, 3, 8); // B to C, three wide
  carve(grid, 7, 13, 2, 9); // A to D, two wide
  carve(grid, 13, 25, 9, 2); // D to C, two wide: this closes the first ring
  carve(grid, 9, 31, 2, 9); // D down ...
  carve(grid, 9, 38, 5, 2); // ... and across to E
  carve(grid, 23, 38, 5, 3); // E across ...
  carve(grid, 25, 32, 3, 6); // ... and up to C: the second ring

  // Pillars in the hall, to walk round.
  for (const [x, y] of [[25, 23], [31, 23], [25, 28], [31, 28]] as const) {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) setCell(grid, x + i, y + j, Cell.Wall);
  }
  // A single pillar, and a jutting piece of wall, to test corners.
  setCell(grid, 9, 8, Cell.Wall);
  setCell(grid, 30, 7, Cell.Wall);
  setCell(grid, 30, 8, Cell.Wall);
  setCell(grid, 31, 8, Cell.Wall);

  setCell(grid, 5, 5, Cell.StairsUp);
  setCell(grid, 18, 41, Cell.StairsDown);

  return { grid, start: { x: 6.5, y: 6.5 } };
}
