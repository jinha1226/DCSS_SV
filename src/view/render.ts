import type { TileName } from '../data/tiles';
import { Cell, cellAt, type Grid } from '../sim/grid';
import { cellNoise } from '../sim/rng';
import type { Showroom, Thing } from '../sim/showroom';
import { drawTile, type Atlas } from './atlas';
import type { Look } from './look';

export interface View {
  /** How many cells fit across the screen. */
  readonly cols: number;
  readonly look: Look;
}

/** The size of one cell in canvas pixels: whole pixels, so tile edges stay sharp. */
export function cellPixels(canvasWidth: number, cols: number): number {
  return Math.max(4, Math.round(canvasWidth / cols));
}

function pick(set: readonly TileName[], x: number, y: number): TileName | undefined {
  return set[Math.floor(cellNoise(x, y) * set.length)];
}

function drawFloor(ctx: CanvasRenderingContext2D, atlas: Atlas, grid: Grid, look: Look, px: number, ox: number, oy: number): void {
  const { width, height } = ctx.canvas;
  const x0 = Math.max(0, Math.floor(-ox / px));
  const y0 = Math.max(0, Math.floor(-oy / px));
  const x1 = Math.min(grid.w, Math.ceil((width - ox) / px));
  const y1 = Math.min(grid.h, Math.ceil((height - oy) / px));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const cell = cellAt(grid, x, y);
      const sx = ox + x * px;
      const sy = oy + y * px;
      const base = pick(cell === Cell.Wall ? look.wall : look.floor, x, y);
      if (base) drawTile(ctx, atlas, base, sx, sy, px);
      if (cell === Cell.StairsDown) drawTile(ctx, atlas, 'feat/stone_stairs_down', sx, sy, px);
      if (cell === Cell.StairsUp) drawTile(ctx, atlas, 'feat/stone_stairs_up', sx, sy, px);
    }
  }
}

function drawThing(ctx: CanvasRenderingContext2D, atlas: Atlas, t: Thing, px: number, ox: number, oy: number): void {
  drawTile(ctx, atlas, t.tile, Math.round(ox + (t.x - 0.5) * px), Math.round(oy + (t.y - 0.5) * px), px);
}

function drawLabel(ctx: CanvasRenderingContext2D, t: Thing, px: number, ox: number, oy: number, dpr: number): void {
  if (!t.label) return;
  const size = Math.max(10 * dpr, px * 0.3);
  ctx.font = `600 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const x = ox + t.x * px;
  const y = oy + (t.y + 0.5) * px + 1;
  ctx.lineWidth = Math.max(2, size * 0.28);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(t.label, x, y);
  ctx.fillStyle = '#f2ead8';
  ctx.fillText(t.label, x, y);
}

/** Draws the room with the hero in the middle of the screen. Returns the cell size in canvas pixels. */
export function drawShowroom(ctx: CanvasRenderingContext2D, atlas: Atlas, room: Showroom, view: View, dpr: number): number {
  const { width, height } = ctx.canvas;
  const px = cellPixels(width, view.cols);
  const ox = Math.round(width / 2 - room.hero.x * px);
  const oy = Math.round(height / 2 - room.hero.y * px);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = view.look.back;
  ctx.fillRect(0, 0, width, height);
  drawFloor(ctx, atlas, room.grid, view.look, px, ox, oy);
  for (const t of room.things) drawThing(ctx, atlas, t, px, ox, oy);
  drawThing(ctx, atlas, room.hero, px, ox, oy);
  for (const t of room.things) drawLabel(ctx, t, px, ox, oy, dpr);
  drawLabel(ctx, room.hero, px, ox, oy, dpr);
  return px;
}
