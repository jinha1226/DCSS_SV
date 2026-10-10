import type { TileName } from '../data/tiles';
import { Cell, cellAt } from '../sim/grid';
import { cellNoise } from '../sim/rng';
import type { World } from '../sim/world';
import { drawTile, type Atlas } from './atlas';
import type { Look } from './look';

export interface View {
  /** How many cells fit across the screen. */
  readonly cols: number;
  readonly look: Look;
}

/** How dark a cell is drawn once it is out of sight but remembered. */
const REMEMBERED = 'rgba(0, 0, 0, 0.58)';

/** The size of one cell in canvas pixels: whole pixels, so tile edges stay sharp. */
export function cellPixels(canvasWidth: number, cols: number): number {
  return Math.max(4, Math.round(canvasWidth / cols));
}

function pick(set: readonly TileName[], x: number, y: number): TileName | undefined {
  return set[Math.floor(cellNoise(x, y) * set.length)];
}

function drawFloor(ctx: CanvasRenderingContext2D, atlas: Atlas, w: World, look: Look, px: number, ox: number, oy: number): void {
  const { width, height } = ctx.canvas;
  const grid = w.grid;
  const x0 = Math.max(0, Math.floor(-ox / px));
  const y0 = Math.max(0, Math.floor(-oy / px));
  const x1 = Math.min(grid.w, Math.ceil((width - ox) / px));
  const y1 = Math.min(grid.h, Math.ceil((height - oy) / px));
  ctx.fillStyle = REMEMBERED;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = y * grid.w + x;
      if (!w.seen[i]) continue;
      const cell = cellAt(grid, x, y);
      const sx = ox + x * px;
      const sy = oy + y * px;
      const base = pick(cell === Cell.Wall ? look.wall : look.floor, x, y);
      if (base) drawTile(ctx, atlas, base, sx, sy, px);
      if (cell === Cell.StairsDown) drawTile(ctx, atlas, 'feat/stone_stairs_down', sx, sy, px);
      if (cell === Cell.StairsUp) drawTile(ctx, atlas, 'feat/stone_stairs_up', sx, sy, px);
      if (!w.visible[i]) ctx.fillRect(sx, sy, px, px);
    }
  }
}

/** Draws a tile with its middle at (cx, cy), turned to face right when `flip` is set. */
function drawFigure(ctx: CanvasRenderingContext2D, atlas: Atlas, tile: TileName, cx: number, cy: number, px: number, flip: boolean): void {
  const x = Math.round(cx - px / 2);
  const y = Math.round(cy - px / 2);
  if (!flip) {
    drawTile(ctx, atlas, tile, x, y, px);
    return;
  }
  ctx.save();
  ctx.translate(x + px, y);
  ctx.scale(-1, 1);
  drawTile(ctx, atlas, tile, 0, 0, px);
  ctx.restore();
}

/**
 * Draws the floor with the hero in the middle of the screen. `between` is how far this frame
 * falls between the last step of the rules and the next, 0 to 1.
 */
export function drawWorld(ctx: CanvasRenderingContext2D, atlas: Atlas, w: World, view: View, between: number): void {
  const { width, height } = ctx.canvas;
  const px = cellPixels(width, view.cols);
  const hx = w.hero.px + (w.hero.x - w.hero.px) * between;
  const hy = w.hero.py + (w.hero.y - w.hero.py) * between;
  const ox = Math.round(width / 2 - hx * px);
  const oy = Math.round(height / 2 - hy * px);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = view.look.back;
  ctx.fillRect(0, 0, width, height);
  drawFloor(ctx, atlas, w, view.look, px, ox, oy);
  // DCSS figures are drawn facing left.
  drawFigure(ctx, atlas, 'hero/minotaur', ox + hx * px, oy + hy * px, px, w.hero.facing === 1);
}
