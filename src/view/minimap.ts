import { Cell, cellAt } from '../sim/grid';
import type { World } from '../sim/world';

/** Draw into the dedicated HUD minimap canvas instead of the dungeon canvas. */
export function drawMiniMap(ctx: CanvasRenderingContext2D, w: World): void {
  const { width, height } = ctx.canvas;
  const scale = Math.min((width - 8) / w.grid.w, (height - 8) / w.grid.h);
  const left = (width - scale * w.grid.w) / 2;
  const top = (height - scale * w.grid.h) / 2;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(10, 12, 15, 0.9)';
  ctx.fillRect(0, 0, width, height);
  for (let row = 0; row < w.grid.h; row++) {
    for (let col = 0; col < w.grid.w; col++) {
      if (!w.seen[row * w.grid.w + col]) continue;
      const cell = cellAt(w.grid, col, row);
      ctx.fillStyle = cell === Cell.Wall ? '#55504a' : cell === Cell.StairsDown ? '#e2bd6d' : '#9d998d';
      ctx.fillRect(left + col * scale, top + row * scale, scale + 0.2, scale + 0.2);
    }
  }
  for (const item of w.groundItems) {
    const ix = Math.floor(item.x);
    const iy = Math.floor(item.y);
    if (!w.seen[iy * w.grid.w + ix]) continue;
    ctx.fillStyle = item.newPath ? '#66d7c2' : '#d9b866';
    ctx.fillRect(left + ix * scale, top + iy * scale, scale, scale);
  }
  ctx.fillStyle = '#ffedb6';
  ctx.fillRect(left + Math.floor(w.hero.x) * scale - 1, top + Math.floor(w.hero.y) * scale - 1, scale + 2, scale + 2);
}
