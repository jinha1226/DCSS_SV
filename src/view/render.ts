import { DUNGEON } from '../data/packs';
import { throwTarget } from '../sim/combat';
import type { TileName } from '../data/tiles';
import { Cell, cellAt } from '../sim/grid';
import { cellNoise } from '../sim/rng';
import type { Monster, World } from '../sim/world';
import { drawTile, type Atlas } from './atlas';
import type { Fx } from './fx';
import type { Look } from './look';
import { drawWalker, walkFrame, type WalkSheet } from './walk';

export interface View {
  /** How many cells fit across the screen. */
  readonly cols: number;
  readonly look: Look;
  /** Canvas pixels to one CSS pixel. */
  readonly dpr: number;
  /** The hero's walk, made from its standing tile. */
  readonly heroWalk: WalkSheet;
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
      if (base) drawTile(ctx, atlas.image, base, sx, sy, px);
      if (cell === Cell.StairsDown) drawTile(ctx, atlas.image, 'feat/stone_stairs_down', sx, sy, px);
      if (cell === Cell.StairsUp) drawTile(ctx, atlas.image, 'feat/stone_stairs_up', sx, sy, px);
      if (!w.visible[i]) ctx.fillRect(sx, sy, px, px);
    }
  }
}

/** Draws a tile with its middle at (cx, cy), turned to face right when `flip` is set. */
function drawFigure(
  ctx: CanvasRenderingContext2D,
  sheet: Atlas['image'],
  tile: TileName,
  cx: number,
  cy: number,
  px: number,
  flip: boolean,
): void {
  const x = Math.round(cx - px / 2);
  const y = Math.round(cy - px / 2);
  if (!flip) {
    drawTile(ctx, sheet, tile, x, y, px);
    return;
  }
  ctx.save();
  ctx.translate(x + px, y);
  ctx.scale(-1, 1);
  drawTile(ctx, sheet, tile, 0, 0, px);
  ctx.restore();
}

function drawMonster(ctx: CanvasRenderingContext2D, atlas: Atlas, w: World, m: Monster, px: number, ox: number, oy: number, between: number): void {
  let x = m.px + (m.x - m.px) * between;
  let y = m.py + (m.y - m.py) * between;
  if (m.wind >= 0) {
    // Drawing back for a blow: it leans away from the hero, then snaps forward as the blow comes.
    const t = 1 - m.wind / m.stats.windup;
    const lean = (t < 0.7 ? -t / 0.7 : (t - 0.7) / 0.3 - 1) * 0.16;
    const d = Math.hypot(w.hero.x - m.x, w.hero.y - m.y) || 1;
    x += ((w.hero.x - m.x) / d) * lean;
    y += ((w.hero.y - m.y) / d) * lean;
  }
  const cx = ox + x * px;
  const cy = oy + y * px;
  drawFigure(ctx, m.flash > 0 ? atlas.struck : atlas.image, m.kind.tile, cx, cy, px, m.facing === 1);
  if (!m.awake) {
    ctx.fillStyle = '#e5e9ef';
    ctx.font = `${Math.max(10, Math.round(px * 0.45))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('z', cx, cy - px * 0.6);
  }
  if (m.hp < m.maxHp) {
    const bw = Math.round(px * 0.7);
    const bh = Math.max(2, Math.round(px * 0.07));
    const bx = Math.round(cx - bw / 2);
    const by = Math.round(cy - px * 0.56);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#c8473a';
    ctx.fillRect(bx, by, Math.round(bw * Math.max(0, m.hp / m.maxHp)), bh);
  }
}

/**
 * Draws the floor with the hero in the middle of the screen. `between` is how far this frame
 * falls between the last step of the rules and the next, 0 to 1.
 */
export function drawWorld(ctx: CanvasRenderingContext2D, atlas: Atlas, w: World, view: View, fx: Fx, between: number): void {
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

  // Monsters out of sight are not drawn, even on remembered ground.
  for (const m of w.monsters) {
    if (!w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]) continue;
    const sx = ox + m.x * px;
    const sy = oy + m.y * px;
    if (sx < -px || sy < -px || sx > width + px || sy > height + px) continue;
    drawMonster(ctx, atlas, w, m, px, ox, oy, between);
  }

  for (const shot of w.shots) {
    const sx = ox + (shot.px + (shot.x - shot.px) * between) * px;
    const sy = oy + (shot.py + (shot.y - shot.py) * between) * px;
    const tile = shot.mine ? 'item/boomerang1' : 'item/stone';
    ctx.save();
    ctx.translate(sx, sy);
    if (shot.mine) ctx.rotate(w.time * 15);
    drawTile(ctx, atlas.image, tile, -px * 0.26, -px * 0.26, px * 0.52);
    ctx.restore();
  }
  const target = throwTarget(w);
  if (target) {
    const tx = ox + target.x * px;
    const ty = oy + target.y * px;
    ctx.strokeStyle = '#e2ce83';
    ctx.lineWidth = Math.max(1, px * 0.065);
    ctx.beginPath();
    ctx.ellipse(tx, ty + px * 0.26, px * 0.42, px * 0.2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const down = w.stairs.find((stair) => stair.down && Math.floor(w.hero.x) === stair.x && Math.floor(w.hero.y) === stair.y);
  if (down && w.descending > 0) {
    ctx.strokeStyle = '#e6c56f';
    ctx.lineWidth = Math.max(2, px * 0.08);
    ctx.beginPath();
    ctx.arc(ox + (down.x + 0.5) * px, oy + (down.y + 0.5) * px, px * 0.48, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, w.descending / DUNGEON.descend));
    ctx.stroke();
  }
  const cx = ox + hx * px;
  const cy = oy + hy * px;
  fx.drawStrokes(ctx, cx, cy, px);
  // DCSS figures are drawn facing left.
  const sheet = w.hero.hurt > 0 ? view.heroWalk.hurt : view.heroWalk.image;
  drawWalker(ctx, sheet, walkFrame(w.hero.moving && !w.over, w.time), cx, cy, px, w.hero.facing === 1);
  fx.drawNumbers(ctx, ox, oy, px, view.dpr);
}
