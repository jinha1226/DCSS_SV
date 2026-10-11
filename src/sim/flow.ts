import { inside, walkable, type Grid } from './grid';

/** For every open cell, how many steps it is from the hero. Monsters walk downhill on it. */
export interface Flow {
  readonly dist: Uint16Array;
  /** The cell the distances were last counted from, or -1. */
  from: number;
}

export const FAR = 0xffff;

export function makeFlow(g: Grid): Flow {
  return { dist: new Uint16Array(g.w * g.h).fill(FAR), from: -1 };
}

const queue: number[] = [];

/** Counts the distances again from the cell (cx, cy), unless they were last counted from there. */
export function updateFlow(flow: Flow, g: Grid, cx: number, cy: number): void {
  if (!inside(g, cx, cy)) return;
  const origin = cy * g.w + cx;
  if (flow.from === origin) return;
  flow.from = origin;
  const dist = flow.dist;
  dist.fill(FAR);
  dist[origin] = 0;
  queue.length = 0;
  queue.push(origin);
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head] as number;
    const x = at % g.w;
    const y = (at - x) / g.w;
    const next = (dist[at] as number) + 1;
    for (const [i, j] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (!walkable(g, i, j)) continue;
      const to = j * g.w + i;
      if (dist[to] !== FAR) continue;
      dist[to] = next;
      queue.push(to);
    }
  }
}

/**
 * The way from (x, y) toward the hero: a direction of length 1, or nothing where no way leads.
 * It aims at the middle of the neighbouring cell nearest the hero, and takes a diagonal only
 * where that does not cut a wall's corner.
 */
export function downhill(flow: Flow, g: Grid, x: number, y: number): { x: number; y: number } | undefined {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (!inside(g, cx, cy)) return undefined;
  let best = flow.dist[cy * g.w + cx] as number;
  let bx = cx;
  let by = cy;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      if (!i && !j) continue;
      const nx = cx + i;
      const ny = cy + j;
      if (!walkable(g, nx, ny)) continue;
      if (i && j && (!walkable(g, cx + i, cy) || !walkable(g, cx, cy + j))) continue;
      // A diagonal is a little longer than a straight step: prefer the straight one on a tie.
      const d = (flow.dist[ny * g.w + nx] as number) + (i && j ? 0.4 : 0);
      if (d < best) {
        best = d;
        bx = nx;
        by = ny;
      }
    }
  }
  if (bx === cx && by === cy) return undefined;
  const dx = bx + 0.5 - x;
  const dy = by + 0.5 - y;
  const len = Math.hypot(dx, dy);
  return len > 1e-6 ? { x: dx / len, y: dy / len } : undefined;
}
