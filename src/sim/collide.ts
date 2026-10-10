import { walkable, type Grid } from './grid';

export interface Point {
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/**
 * Pushes a circle out of every wall cell it overlaps. Flat sides are settled before corners, so
 * a circle pressed against a wall made of many cells slides along it without catching on the
 * seams between them.
 */
function pushOut(g: Grid, p: Point, r: number): void {
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const corners of [false, true]) {
      const x0 = Math.floor(p.x - r);
      const x1 = Math.floor(p.x + r);
      const y0 = Math.floor(p.y - r);
      const y1 = Math.floor(p.y + r);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          if (walkable(g, cx, cy)) continue;
          const nx = clamp(p.x, cx, cx + 1);
          const ny = clamp(p.y, cy, cy + 1);
          const dx = p.x - nx;
          const dy = p.y - ny;
          const isCorner = dx !== 0 && dy !== 0;
          if (isCorner !== corners) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          if (d2 > 1e-12) {
            const d = Math.sqrt(d2);
            p.x = nx + (dx / d) * r;
            p.y = ny + (dy / d) * r;
          } else {
            escape(g, p, r, cx, cy);
          }
          moved = true;
        }
      }
    }
    if (!moved) return;
  }
}

/** The middle of the circle is inside a wall cell: leave through the nearest side that is open. */
function escape(g: Grid, p: Point, r: number, cx: number, cy: number): void {
  const sides = [
    { open: walkable(g, cx - 1, cy), depth: p.x - cx, x: cx - r, y: p.y },
    { open: walkable(g, cx + 1, cy), depth: cx + 1 - p.x, x: cx + 1 + r, y: p.y },
    { open: walkable(g, cx, cy - 1), depth: p.y - cy, x: p.x, y: cy - r },
    { open: walkable(g, cx, cy + 1), depth: cy + 1 - p.y, x: p.x, y: cy + 1 + r },
  ]
    .filter((s) => s.open)
    .sort((a, b) => a.depth - b.depth);
  const out = sides[0];
  if (out) {
    p.x = out.x;
    p.y = out.y;
  }
}

/**
 * Moves a circle of radius `r` by (dx, dy) across the floor. Walls stop it; what is left of the
 * movement runs along the wall, and a corner is rounded rather than caught on.
 */
export function moveCircle(g: Grid, from: Point, r: number, dx: number, dy: number): Point {
  const p = { x: from.x, y: from.y };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (r * 0.5)));
  for (let i = 0; i < steps; i++) {
    p.x += dx / steps;
    p.y += dy / steps;
    pushOut(g, p, r);
  }
  return p;
}

/** How far the circle's middle is from the nearest wall, at most `reach` cells away. */
export function wallGap(g: Grid, p: Point, reach = 2): number {
  let best = Infinity;
  for (let cy = Math.floor(p.y - reach); cy <= Math.floor(p.y + reach); cy++) {
    for (let cx = Math.floor(p.x - reach); cx <= Math.floor(p.x + reach); cx++) {
      if (walkable(g, cx, cy)) continue;
      best = Math.min(best, Math.hypot(p.x - clamp(p.x, cx, cx + 1), p.y - clamp(p.y, cy, cy + 1)));
    }
  }
  return best;
}
