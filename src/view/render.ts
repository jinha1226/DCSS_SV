import { brandData } from '../data/items';
import { DUNGEON } from '../data/packs';
import type { SpellData } from '../data/spells';
import { bowTarget, throwTarget } from '../sim/combat';
import type { TileName } from '../data/tiles';
import { Cell, cellAt } from '../sim/grid';
import { cellNoise } from '../sim/rng';
import { spellCandidates } from '../sim/spells';
import { objectiveFor } from '../sim/objectives';
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
  readonly targetingSpell?: SpellData;
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
      if (cell === Cell.Water) {
        ctx.fillStyle = w.dungeonGraph.nodes.get(w.depth)?.branch === 'Swamp' ? 'rgba(56, 91, 63, 0.62)' : 'rgba(41, 105, 151, 0.65)';
        ctx.fillRect(sx, sy, px, px);
      }
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

function drawMonster(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  w: World,
  m: Monster,
  px: number,
  ox: number,
  oy: number,
  between: number,
): void {
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

function drawThreatArrows(ctx: CanvasRenderingContext2D, w: World, px: number, width: number, height: number, dpr: number): void {
  const sectors = new Set<number>();
  for (const monster of w.monsters) {
    const index = Math.floor(monster.y) * w.grid.w + Math.floor(monster.x);
    if (!monster.awake || monster.hp <= 0 || w.visible[index]) continue;
    const angle = Math.atan2(monster.y - w.hero.y, monster.x - w.hero.x);
    sectors.add(Math.round(angle / (Math.PI / 4)));
  }
  const radiusX = width / 2 - Math.max(18 * dpr, px * 0.45);
  const radiusY = height / 2 - Math.max(80 * dpr, px * 0.8);
  ctx.fillStyle = 'rgba(224, 200, 142, 0.82)';
  for (const sector of sectors) {
    const angle = sector * (Math.PI / 4);
    const x = width / 2 + Math.cos(angle) * radiusX;
    const y = height / 2 + Math.sin(angle) * radiusY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(7 * dpr, 0);
    ctx.lineTo(-5 * dpr, -4 * dpr);
    ctx.lineTo(-5 * dpr, 4 * dpr);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
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

  for (const item of w.groundItems) {
    const ix = Math.floor(item.x),
      iy = Math.floor(item.y);
    if (!w.seen[iy * w.grid.w + ix]) continue;
    const sx = ox + item.x * px,
      sy = oy + item.y * px;
    if (item.kind === 'book') {
      ctx.fillStyle = '#393052';
      ctx.fillRect(sx - px * 0.25, sy - px * 0.3, px * 0.5, px * 0.6);
      ctx.strokeStyle = '#b6a4da';
      ctx.lineWidth = Math.max(1, px * 0.04);
      ctx.strokeRect(sx - px * 0.25, sy - px * 0.3, px * 0.5, px * 0.6);
      ctx.fillStyle = '#e3d9ff';
      ctx.font = `${Math.max(10, px * 0.32)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('✦', sx, sy + px * 0.1);
      continue;
    }
    if (item.kind === 'gold') {
      ctx.fillStyle = '#f3ca56';
      ctx.beginPath();
      ctx.arc(sx, sy, px * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#77521e';
      ctx.lineWidth = Math.max(1, px * 0.05);
      ctx.stroke();
      continue;
    }
    if (item.kind === 'consumable') {
      ctx.fillStyle = item.itemId === 'potion_healing' ? '#c95463' : item.itemId === 'scroll_blink' ? '#d6c18b' : '#93b7e1';
      ctx.beginPath();
      ctx.arc(sx, sy, px * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = Math.max(1, px * 0.04);
      ctx.stroke();
      continue;
    }
    const tile = item.kind === 'ammo' ? 'item/boomerang1' : item.axe?.tile;
    if (!tile) continue;
    drawFigure(ctx, atlas.image, tile, sx, sy, px * 0.72, false);
    if (item.newPath) {
      ctx.strokeStyle = '#5ad8c0';
      ctx.lineWidth = Math.max(2, px * 0.06);
      ctx.strokeRect(sx - px * 0.39, sy - px * 0.39, px * 0.78, px * 0.78);
    } else if (item.axe?.special) {
      ctx.strokeStyle = '#d6b96d';
      ctx.lineWidth = Math.max(1, px * 0.04);
      ctx.strokeRect(sx - px * 0.35, sy - px * 0.35, px * 0.7, px * 0.7);
    } else if (item.axe?.brand) {
      ctx.fillStyle = brandData(item.axe.brand)?.colour ?? '#aaa';
      ctx.beginPath();
      ctx.arc(sx, sy + px * 0.31, Math.max(2, px * 0.07), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const objective = objectiveFor(w);
  if (objective && w.visible[Math.floor(objective.y) * w.grid.w + Math.floor(objective.x)]) {
    const x = ox + objective.x * px;
    const y = oy + objective.y * px;
    ctx.fillStyle = objective.kind === 'orb' ? '#d8a9ff' : '#e9c96e';
    ctx.beginPath();
    ctx.arc(x, y, px * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff4d8';
    ctx.lineWidth = Math.max(1, px * 0.055);
    ctx.stroke();
  }

  // Monsters out of sight are not drawn, even on remembered ground.
  for (const m of w.monsters) {
    if (!w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]) continue;
    const sx = ox + m.x * px;
    const sy = oy + m.y * px;
    if (sx < -px || sy < -px || sx > width + px || sy > height + px) continue;
    drawMonster(ctx, atlas, w, m, px, ox, oy, between);
  }

  for (const cloud of w.spellClouds) {
    ctx.fillStyle = cloud.colour + '28';
    ctx.beginPath();
    ctx.arc(ox + cloud.x * px, oy + cloud.y * px, cloud.radius * px, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const visual of w.spellVisuals) {
    ctx.strokeStyle = visual.colour;
    ctx.lineWidth = Math.max(2, px * 0.08);
    ctx.globalAlpha = Math.min(1, visual.left / 0.12);
    if (visual.shape === 'beam') {
      ctx.beginPath();
      ctx.moveTo(ox + visual.x1 * px, oy + visual.y1 * px);
      ctx.lineTo(ox + visual.x2 * px, oy + visual.y2 * px);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(ox + visual.x2 * px, oy + visual.y2 * px, visual.radius * px, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  for (const shot of w.spellShots) {
    const sx = ox + (shot.px + (shot.x - shot.px) * between) * px;
    const sy = oy + (shot.py + (shot.y - shot.py) * between) * px;
    ctx.fillStyle = shot.colour;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(2, px * 0.11), 0, Math.PI * 2);
    ctx.fill();
  }

  drawThreatArrows(ctx, w, px, width, height, view.dpr);

  for (const shot of w.shots) {
    const sx = ox + (shot.px + (shot.x - shot.px) * between) * px;
    const sy = oy + (shot.py + (shot.y - shot.py) * between) * px;
    if (shot.arrow) {
      const angle = Math.atan2(shot.vy, shot.vx);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(angle);
      ctx.strokeStyle = '#e8ddbd';
      ctx.lineWidth = Math.max(1, px * 0.045);
      ctx.beginPath();
      ctx.moveTo(-px * 0.22, 0);
      ctx.lineTo(px * 0.22, 0);
      ctx.stroke();
      ctx.restore();
      continue;
    }
    const tile = shot.mine ? 'item/boomerang1' : 'item/stone';
    ctx.save();
    ctx.translate(sx, sy);
    if (shot.mine) ctx.rotate(w.time * 15);
    drawTile(ctx, atlas.image, tile, -px * 0.26, -px * 0.26, px * 0.52);
    ctx.restore();
  }
  if (view.targetingSpell) {
    for (const target of spellCandidates(w, view.targetingSpell)) {
      const tx = ox + target.x * px;
      const ty = oy + target.y * px;
      ctx.strokeStyle = view.targetingSpell.colour;
      ctx.lineWidth = Math.max(2, px * 0.075);
      ctx.beginPath();
      ctx.arc(tx, ty, px * 0.48, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const target = bowTarget(w) ?? throwTarget(w);
    if (target) {
      const tx = ox + target.x * px;
      const ty = oy + target.y * px;
      ctx.strokeStyle = '#e2ce83';
      ctx.lineWidth = Math.max(1, px * 0.065);
      ctx.beginPath();
      ctx.ellipse(tx, ty + px * 0.26, px * 0.42, px * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  const down = w.stairs.find((stair) => stair.down && Math.floor(w.hero.x) === stair.x && Math.floor(w.hero.y) === stair.y);
  if (down && w.descending > 0) {
    ctx.strokeStyle = '#e6c56f';
    ctx.lineWidth = Math.max(2, px * 0.08);
    ctx.beginPath();
    ctx.arc(
      ox + (down.x + 0.5) * px,
      oy + (down.y + 0.5) * px,
      px * 0.48,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * Math.min(1, w.descending / DUNGEON.descend),
    );
    ctx.stroke();
  }
  let heroX = hx;
  let heroY = hy;
  let lift = 0;
  if (w.hero.hopTime > 0 && w.hero.hopDuration > 0) {
    const t = 1 - w.hero.hopTime / w.hero.hopDuration;
    heroX = w.hero.hopFromX + (w.hero.hopToX - w.hero.hopFromX) * t;
    heroY = w.hero.hopFromY + (w.hero.hopToY - w.hero.hopFromY) * t;
    lift = Math.sin(t * Math.PI) * px * 0.55;
  }
  const cx = ox + heroX * px;
  const groundCy = oy + heroY * px;
  const cy = groundCy - lift;
  if (w.hero.hopTime > 0) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(cx, groundCy + px * 0.25, px * 0.28, px * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  fx.drawStrokes(ctx, cx, groundCy, px);
  // DCSS figures are drawn facing left.
  const sheet = w.hero.hurt > 0 ? view.heroWalk.hurt : view.heroWalk.image;
  drawWalker(ctx, sheet, walkFrame(w.hero.moving && !w.over && w.hero.hopTime <= 0, w.time), cx, cy, px, w.hero.facing === 1);
  fx.drawNumbers(ctx, ox, oy, px, view.dpr);
  const icon = Math.max(24 * view.dpr, px * 0.65);
  drawTile(ctx, atlas.image, w.weapon.tile, width - icon - 10 * view.dpr, height - icon - 126 * view.dpr, icon);
}
