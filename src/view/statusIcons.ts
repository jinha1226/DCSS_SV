import type { Monster } from '../sim/types';
import { PALETTES, styleOf } from './elementStyle';

/**
 * What is wrong with a monster, readable at a glance: a row of small icons over its head,
 * plus a hint on the body (stars for a stun, flames for burning, frost at the feet for a slow,
 * a turning brand under a marked one).
 */
type Status = 'stun' | 'slow' | 'confuse' | 'fear' | 'burn' | 'poison' | 'vulnerable' | 'rot';

const ICON_COLOURS: Readonly<Record<Status, string>> = {
  stun: '#f5d76e',
  slow: '#9fdcf5',
  confuse: '#c9a3f5',
  fear: '#ff8a7a',
  burn: '#f08a32',
  poison: '#8fd05a',
  vulnerable: '#ff6b6b',
  rot: '#9a6fc4',
};

export function monsterStatuses(m: Monster): Status[] {
  const list: Status[] = [];
  if (m.stun > 0) list.push('stun');
  if (m.slow > 0) list.push('slow');
  if (m.confusion > 0) list.push('confuse');
  if (m.fear > 0) list.push('fear');
  if (m.burning > 0) list.push('burn');
  if (m.poison > 0) list.push('poison');
  if (m.vulnerable > 0) list.push('vulnerable');
  if (m.rot > 0) list.push('rot');
  return list;
}

function drawGlyph(ctx: CanvasRenderingContext2D, status: Status, x: number, y: number, s: number): void {
  ctx.fillStyle = ICON_COLOURS[status];
  ctx.strokeStyle = ICON_COLOURS[status];
  ctx.lineWidth = Math.max(1, s * 0.16);
  ctx.beginPath();
  switch (status) {
    case 'stun':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? s * 0.2 : s * 0.42;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      return;
    case 'slow':
      // An hourglass.
      ctx.moveTo(x - s * 0.3, y - s * 0.38);
      ctx.lineTo(x + s * 0.3, y - s * 0.38);
      ctx.lineTo(x - s * 0.3, y + s * 0.38);
      ctx.lineTo(x + s * 0.3, y + s * 0.38);
      ctx.closePath();
      ctx.fill();
      return;
    case 'confuse':
      for (let i = 0; i <= 20; i++) {
        const a = i * 0.55;
        const r = s * 0.04 + i * s * 0.019;
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.stroke();
      return;
    case 'fear':
      ctx.fillRect(x - s * 0.08, y - s * 0.4, s * 0.16, s * 0.5);
      ctx.fillRect(x - s * 0.08, y + s * 0.22, s * 0.16, s * 0.16);
      return;
    case 'burn':
      ctx.moveTo(x, y - s * 0.45);
      ctx.quadraticCurveTo(x + s * 0.4, y, x, y + s * 0.4);
      ctx.quadraticCurveTo(x - s * 0.4, y, x, y - s * 0.45);
      ctx.fill();
      return;
    case 'poison':
      ctx.moveTo(x, y - s * 0.42);
      ctx.quadraticCurveTo(x + s * 0.36, y + s * 0.05, x, y + s * 0.38);
      ctx.quadraticCurveTo(x - s * 0.36, y + s * 0.05, x, y - s * 0.42);
      ctx.fill();
      return;
    case 'vulnerable':
      // A shield with a crack through it.
      ctx.moveTo(x - s * 0.32, y - s * 0.36);
      ctx.lineTo(x + s * 0.32, y - s * 0.36);
      ctx.lineTo(x + s * 0.28, y + s * 0.1);
      ctx.lineTo(x, y + s * 0.42);
      ctx.lineTo(x - s * 0.28, y + s * 0.1);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + s * 0.05, y - s * 0.36);
      ctx.lineTo(x - s * 0.08, y);
      ctx.lineTo(x + s * 0.06, y + s * 0.2);
      ctx.stroke();
      return;
    case 'rot':
      ctx.arc(x, y - s * 0.05, s * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1b1022';
      ctx.fillRect(x - s * 0.18, y - s * 0.12, s * 0.12, s * 0.12);
      ctx.fillRect(x + s * 0.06, y - s * 0.12, s * 0.12, s * 0.12);
      return;
  }
}

function drawBodyHints(ctx: CanvasRenderingContext2D, m: Monster, cx: number, cy: number, px: number, time: number): void {
  if (m.slow > 0) {
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = PALETTES.ice.main;
    ctx.beginPath();
    ctx.ellipse(cx, cy + px * 0.36, px * 0.36, px * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (m.burning > 0) {
    // Small tongues of flame licking up the body.
    for (let i = 0; i < 3; i++) {
      const fx = cx + (i - 1) * px * 0.18;
      const h = px * (0.18 + 0.08 * Math.sin(time * 22 + i * 2));
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = i === 1 ? PALETTES.fire.core : PALETTES.fire.main;
      ctx.beginPath();
      ctx.moveTo(fx - px * 0.06, cy + px * 0.2);
      ctx.quadraticCurveTo(fx, cy + px * 0.2 - h * 2, fx + px * 0.06, cy + px * 0.2);
      ctx.fill();
    }
  }
  if (m.poison > 0) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = PALETTES.poison.main;
    for (let i = 0; i < 3; i++) {
      const rise = (time * 0.8 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(cx + (i - 1) * px * 0.15, cy + px * 0.2 - rise * px * 0.5, px * 0.04 * (1 - rise * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (m.stun > 0) {
    // Stars circling the head.
    ctx.globalAlpha = 0.95;
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + (i / 3) * Math.PI * 2;
      drawGlyph(ctx, 'stun', cx + Math.cos(a) * px * 0.3, cy - px * 0.42 + Math.sin(a) * px * 0.08, px * 0.16);
    }
  }
  if (m.mark) {
    const style = styleOf(m.mark.spellId);
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = PALETTES[style].main;
    ctx.lineWidth = Math.max(1, px * 0.05);
    ctx.setLineDash([px * 0.12, px * 0.08]);
    ctx.lineDashOffset = -time * px;
    ctx.beginPath();
    ctx.ellipse(cx, cy + px * 0.34, px * 0.42, px * 0.14, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }
  ctx.globalAlpha = 1;
}

/** Status icons over the head and hints on the body. `top` is the screen y just above the health bar. */
export function drawMonsterStatus(
  ctx: CanvasRenderingContext2D,
  m: Monster,
  cx: number,
  cy: number,
  px: number,
  top: number,
  time: number,
): void {
  drawBodyHints(ctx, m, cx, cy, px, time);
  const statuses = monsterStatuses(m);
  if (!statuses.length) return;
  const s = Math.max(12, px * 0.36);
  const gap = s * 1.15;
  const y = top - s * 0.75;
  let x = cx - ((statuses.length - 1) * gap) / 2;
  for (const status of statuses) {
    ctx.fillStyle = 'rgba(12, 10, 16, 0.72)';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.58, 0, Math.PI * 2);
    ctx.fill();
    drawGlyph(ctx, status, x, y, s);
    x += gap;
  }
}
