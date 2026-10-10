import { inside, walkable, type Grid } from './grid';

// The eight octants a circle of sight is swept in: how (column, row) of a sweep maps to (x, y).
const OCTANTS = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
] as const;

/**
 * Marks in `out` (one byte per cell, cleared first) every cell that can be seen from the cell
 * (ox, oy) within `radius` cells. Walls block sight and are themselves seen.
 */
export function computeFov(g: Grid, ox: number, oy: number, radius: number, out: Uint8Array): void {
  out.fill(0);
  if (!inside(g, ox, oy)) return;
  out[oy * g.w + ox] = 1;
  for (const [xx, xy, yx, yy] of OCTANTS) sweep(g, ox, oy, radius, 1, 1, 0, xx, xy, yx, yy, out);
}

function sweep(
  g: Grid,
  ox: number,
  oy: number,
  radius: number,
  row: number,
  start: number,
  end: number,
  xx: number,
  xy: number,
  yx: number,
  yy: number,
  out: Uint8Array,
): void {
  if (start < end) return;
  const r2 = (radius + 0.5) * (radius + 0.5);
  let nextStart = start;
  for (let j = row; j <= radius; j++) {
    let blocked = false;
    for (let dx = -j, dy = -j; dx <= 0; dx++) {
      const left = (dx - 0.5) / (dy + 0.5);
      const right = (dx + 0.5) / (dy - 0.5);
      if (start < right) continue;
      if (end > left) break;
      const x = ox + dx * xx + dy * xy;
      const y = oy + dx * yx + dy * yy;
      if (dx * dx + dy * dy <= r2 && inside(g, x, y)) out[y * g.w + x] = 1;
      const wall = !walkable(g, x, y);
      if (blocked) {
        if (wall) {
          nextStart = right;
        } else {
          blocked = false;
          start = nextStart;
        }
      } else if (wall && j < radius) {
        blocked = true;
        sweep(g, ox, oy, radius, j + 1, start, left, xx, xy, yx, yy, out);
        nextStart = right;
      }
    }
    if (blocked) return;
  }
}
