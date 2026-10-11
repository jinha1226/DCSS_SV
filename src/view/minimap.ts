import { Cell, cellAt } from '../sim/grid';
import type { World } from '../sim/world';

/** Small map of explored ground; deliberately has no pointer interaction. */
export function drawMiniMap(ctx: CanvasRenderingContext2D, w: World, dpr: number): void {
  const scale = Math.max(2, Math.round(2 * dpr));
  const width = w.grid.w * scale;
  // Top left, under the strip of health and time.
  const x = Math.round(12 * dpr);
  const y = Math.round(72 * dpr);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x - 3, y - 3, width + 6, w.grid.h * scale + 6);
  for (let row = 0; row < w.grid.h; row++) {
    for (let col = 0; col < w.grid.w; col++) {
      if (!w.seen[row * w.grid.w + col]) continue;
      const cell = cellAt(w.grid, col, row);
      ctx.fillStyle = cell === Cell.Wall ? '#55504a' : cell === Cell.StairsDown ? '#e2bd6d' : '#9d998d';
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
  ctx.fillStyle = '#d9b866';
  for (const item of w.groundItems) {
    const ix = Math.floor(item.x),
      iy = Math.floor(item.y);
    if (!w.seen[iy * w.grid.w + ix]) continue;
    ctx.fillStyle = item.newPath ? '#66d7c2' : '#d9b866';
    ctx.fillRect(x + ix * scale, y + iy * scale, scale, scale);
  }
  ctx.fillStyle = '#ffedb6';
  ctx.fillRect(x + Math.floor(w.hero.x) * scale - 1, y + Math.floor(w.hero.y) * scale - 1, scale + 2, scale + 2);
}
