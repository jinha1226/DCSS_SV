import { heroGive } from './skills';
import type { World } from './types';

/** How much of an overlap between two monsters is undone in one step; less than all of it keeps a pack from shaking. */
const FIRM = 0.5;

let head = new Int32Array(0);
let next = new Int32Array(0);

/** How far each monster is to be pushed this step; grown as needed, reused between steps. */
export interface Shoves {
  x: Float32Array;
  y: Float32Array;
  heroX: number;
  heroY: number;
}

const shoves: Shoves = { x: new Float32Array(0), y: new Float32Array(0), heroX: 0, heroY: 0 };

/**
 * Works out how bodies that overlap push each other apart: monster from monster, and monster
 * from hero. Nothing is moved here; the pushes are handed back to be walked through the walls.
 */
export function shove(w: World): Shoves {
  const monsters = w.monsters;
  const n = monsters.length;
  const cells = w.grid.w * w.grid.h;
  if (head.length !== cells) head = new Int32Array(cells);
  if (next.length < n) next = new Int32Array(n * 2 + 16);
  if (shoves.x.length < n) {
    shoves.x = new Float32Array(n * 2 + 16);
    shoves.y = new Float32Array(n * 2 + 16);
  }
  shoves.x.fill(0, 0, n);
  shoves.y.fill(0, 0, n);
  shoves.heroX = 0;
  shoves.heroY = 0;

  // Sort the monsters into the cells they stand in.
  head.fill(-1);
  const cellOf = (x: number, y: number): number => {
    const cx = Math.min(w.grid.w - 1, Math.max(0, Math.floor(x)));
    const cy = Math.min(w.grid.h - 1, Math.max(0, Math.floor(y)));
    return cy * w.grid.w + cx;
  };
  for (let i = 0; i < n; i++) {
    const m = monsters[i]!;
    const c = cellOf(m.x, m.y);
    next[i] = head[c]!;
    head[c] = i;
  }

  for (let i = 0; i < n; i++) {
    const a = monsters[i]!;
    const cx = Math.floor(a.x);
    const cy = Math.floor(a.y);
    for (let gy = cy - 1; gy <= cy + 1; gy++) {
      if (gy < 0 || gy >= w.grid.h) continue;
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        if (gx < 0 || gx >= w.grid.w) continue;
        for (let j = head[gy * w.grid.w + gx]!; j !== -1; j = next[j]!) {
          if (j <= i) continue;
          const b = monsters[j]!;
          const need = a.stats.radius + b.stats.radius;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d = Math.hypot(dx, dy);
          if (d >= need) continue;
          if (d < 1e-4) {
            // Standing on the same spot: part them along a direction that differs for each pair.
            const angle = (i * 2.399 + j) % 6.283;
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            d = 1;
          }
          const push = ((need - d) * FIRM) / 2;
          shoves.x[i]! -= (dx / d) * push;
          shoves.y[i]! -= (dy / d) * push;
          shoves.x[j]! += (dx / d) * push;
          shoves.y[j]! += (dy / d) * push;
        }
      }
    }

    // The hero is heavy: most of a shove moves the monster.
    const need = w.heroDef.radius + a.stats.radius;
    const dx = a.x - w.hero.x;
    const dy = a.y - w.hero.y;
    const d = Math.hypot(dx, dy);
    if (d < need && d > 1e-4) {
      const over = need - d;
      shoves.x[i]! += (dx / d) * over * (1 - heroGive(w));
      shoves.y[i]! += (dy / d) * over * (1 - heroGive(w));
      shoves.heroX -= (dx / d) * over * heroGive(w);
      shoves.heroY -= (dy / d) * over * heroGive(w);
    }
  }
  return shoves;
}
