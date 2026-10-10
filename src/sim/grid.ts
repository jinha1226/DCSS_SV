/** What a cell of a floor is made of. */
export const Cell = { Wall: 0, Floor: 1, StairsDown: 2, StairsUp: 3 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

/** A floor: `w` by `h` cells, one cell is 1.0 in world units. */
export interface Grid {
  readonly w: number;
  readonly h: number;
  readonly cells: Uint8Array;
}

export function makeGrid(w: number, h: number, fill: Cell = Cell.Wall): Grid {
  return { w, h, cells: new Uint8Array(w * h).fill(fill) };
}

export function inside(g: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < g.w && y < g.h;
}

/** The cell at (x, y); anything off the floor counts as wall. */
export function cellAt(g: Grid, x: number, y: number): Cell {
  return inside(g, x, y) ? (g.cells[y * g.w + x] as Cell) : Cell.Wall;
}

export function setCell(g: Grid, x: number, y: number, c: Cell): void {
  if (inside(g, x, y)) g.cells[y * g.w + x] = c;
}

export function walkable(g: Grid, x: number, y: number): boolean {
  return cellAt(g, x, y) !== Cell.Wall;
}

/** Opens a rectangle of floor. */
export function carve(g: Grid, x: number, y: number, w: number, h: number): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setCell(g, i, j, Cell.Floor);
}
