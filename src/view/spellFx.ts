import type { SpellCloud, SpellOngoing, SpellShot, SpellVisual, World } from '../sim/types';
import { mix, PALETTES, styleOf, type ElementStyle } from './elementStyle';
import { blast, emit, Particles } from './particles';

/**
 * Spells drawn as their element moves: fire flickers and throws embers upwards, frost hangs and glints,
 * lightning is a different jagged path every frame, stone tumbles and raises dust, poison bubbles,
 * necrotic force curls. Normal blending only, and nothing flashes or shakes the whole screen.
 */
const particles = new Particles();
const burstsSeen = new WeakSet<SpellVisual>();

interface Frame {
  readonly ctx: CanvasRenderingContext2D;
  readonly ox: number;
  readonly oy: number;
  readonly px: number;
  readonly time: number;
  /** Game seconds since the last frame (0 while paused). */
  readonly dt: number;
}

const sx = (f: Frame, x: number): number => f.ox + x * f.px;
const sy = (f: Frame, y: number): number => f.oy + y * f.px;

/** Emits on average `rate` puffs per game second. */
function chance(f: Frame, rate: number): number {
  const expected = rate * f.dt;
  return Math.floor(expected) + (Math.random() < expected % 1 ? 1 : 0);
}

/** A crooked line between two screen points, re-drawn differently every frame like real lightning. */
function jagged(f: Frame, x1: number, y1: number, x2: number, y2: number, colour: string, width: number, roughness = 0.35): void {
  const { ctx } = f;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  const steps = Math.max(3, Math.round(length / (f.px * 0.35)));
  const nx = -dy / (length || 1);
  const ny = dx / (length || 1);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const off = (Math.random() - 0.5) * f.px * roughness * 2;
    ctx.lineTo(x1 + dx * t + nx * off, y1 + dy * t + ny * off);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function glow(f: Frame, x: number, y: number, r: number, style: ElementStyle, alpha = 1): void {
  const palette = PALETTES[style];
  const g = f.ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, palette.core);
  g.addColorStop(0.45, palette.main);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  f.ctx.globalAlpha = alpha;
  f.ctx.fillStyle = g;
  f.ctx.beginPath();
  f.ctx.arc(x, y, r, 0, Math.PI * 2);
  f.ctx.fill();
  f.ctx.globalAlpha = 1;
}

function drawShot(f: Frame, shot: SpellShot, between: number): void {
  const style = styleOf(shot.spellId);
  const x = shot.px + (shot.x - shot.px) * between;
  const y = shot.py + (shot.y - shot.py) * between;
  const X = sx(f, x);
  const Y = sy(f, y);
  const angle = Math.atan2(shot.vy, shot.vx);
  const r = f.px * 0.16;
  const { ctx } = f;
  const trail = { x: -shot.vx * 0.15, y: -shot.vy * 0.15 };
  const puffs = chance(f, style === 'lightning' ? 20 : 45);
  if (puffs) emit(particles, style, x, y, trail, puffs);
  switch (style) {
    case 'fire': {
      // A teardrop of flame, flickering, streaming back from the direction of travel.
      const flicker = 1 + 0.18 * Math.sin(f.time * 40 + shot.x * 3);
      glow(f, X, Y, r * 2.2 * flicker, 'fire', 0.85);
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(angle);
      ctx.fillStyle = PALETTES.fire.main;
      ctx.beginPath();
      ctx.moveTo(r * 1.1, 0);
      ctx.quadraticCurveTo(-r * 0.5, -r * 1.1 * flicker, -r * 3, Math.sin(f.time * 30) * r * 0.4);
      ctx.quadraticCurveTo(-r * 0.5, r * 1.1 * flicker, r * 1.1, 0);
      ctx.fill();
      ctx.fillStyle = PALETTES.fire.core;
      ctx.beginPath();
      ctx.arc(r * 0.3, 0, r * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'ice': {
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(angle);
      ctx.fillStyle = PALETTES.ice.main;
      ctx.strokeStyle = PALETTES.ice.core;
      ctx.lineWidth = Math.max(1, r * 0.25);
      ctx.beginPath();
      ctx.moveTo(r * 2.2, 0);
      ctx.lineTo(0, -r * 0.6);
      ctx.lineTo(-r * 1.4, 0);
      ctx.lineTo(0, r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'lightning':
      glow(f, X, Y, r * 1.8, 'lightning', 0.8);
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        jagged(f, X, Y, X + Math.cos(a) * r * 2.6, Y + Math.sin(a) * r * 2.6, PALETTES.lightning.core, Math.max(1, r * 0.25), 0.15);
      }
      return;
    case 'earth': {
      ctx.save();
      ctx.translate(X, Y);
      ctx.rotate(f.time * 9);
      ctx.fillStyle = PALETTES.earth.main;
      ctx.strokeStyle = '#4c3a28';
      ctx.lineWidth = Math.max(1, r * 0.2);
      ctx.beginPath();
      const corners = [1, 0.75, 0.95, 0.7, 0.9, 0.8];
      corners.forEach((k, i) => ctx.lineTo(Math.cos((i / 6) * Math.PI * 2) * r * 1.3 * k, Math.sin((i / 6) * Math.PI * 2) * r * 1.3 * k));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      return;
    }
    case 'poison': {
      const wob = Math.sin(f.time * 25 + shot.y * 4) * 0.2;
      ctx.fillStyle = PALETTES.poison.main;
      ctx.beginPath();
      ctx.ellipse(X, Y, r * (1.1 + wob), r * (1.1 - wob), angle, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTES.poison.core;
      ctx.beginPath();
      ctx.arc(X - r * 0.3, Y - r * 0.3, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'death':
      glow(f, X, Y, r * 2, 'death', 0.9);
      ctx.fillStyle = PALETTES.death.fade;
      ctx.beginPath();
      ctx.arc(X, Y, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'hex':
    case 'spirit': {
      glow(f, X, Y, r * 1.8, style, 0.85);
      ctx.fillStyle = PALETTES[style].core;
      for (let i = 0; i < 3; i++) {
        const a = f.time * 10 + (i / 3) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(X + Math.cos(a) * r * 1.6, Y + Math.sin(a) * r * 1.6, Math.max(1, r * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
  }
}

function drawBeam(f: Frame, v: SpellVisual, style: ElementStyle, fade: number): void {
  const { ctx } = f;
  const x1 = sx(f, v.x1);
  const y1 = sy(f, v.y1);
  const x2 = sx(f, v.x2);
  const y2 = sy(f, v.y2);
  const width = Math.max(2, f.px * 0.1);
  ctx.globalAlpha = fade;
  if (style === 'lightning' || style === 'hex') {
    jagged(f, x1, y1, x2, y2, PALETTES[style].main, width * 1.6, 0.4);
    jagged(f, x1, y1, x2, y2, PALETTES[style].core, width * 0.6, 0.25);
  } else {
    // Fire, life drain and stone pour along a wavering band rather than a ruler-straight line.
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / length;
    const ny = (x2 - x1) / length;
    for (let band = 0; band < 3; band++) {
      const outer = style === 'fire' ? '#c2401f' : mix(PALETTES[style].main, PALETTES[style].fade, 0.5);
      ctx.strokeStyle = band === 2 ? PALETTES[style].core : band === 1 ? PALETTES[style].main : outer;
      ctx.lineWidth = width * (2.2 - band * 0.7);
      ctx.beginPath();
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const wave = Math.sin(t * 12 + f.time * 30 + band) * f.px * 0.08 * (1 - band * 0.3);
        ctx.lineTo(x1 + (x2 - x1) * t + nx * wave, y1 + (y2 - y1) * t + ny * wave);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  // The element keeps coming off the beam while it lasts: embers rise, frost drifts, dust falls away.
  const length = Math.hypot(v.x2 - v.x1, v.y2 - v.y1);
  for (let i = chance(f, length * 30); i > 0; i--) {
    const t = Math.random();
    emit(particles, style, v.x1 + (v.x2 - v.x1) * t, v.y1 + (v.y2 - v.y1) * t);
  }
}

function drawBurst(f: Frame, v: SpellVisual, style: ElementStyle, progress: number): void {
  if (!burstsSeen.has(v)) {
    burstsSeen.add(v);
    blast(particles, style, v.x2, v.y2, v.radius);
  }
  const X = sx(f, v.x2);
  const Y = sy(f, v.y2);
  const r = v.radius * f.px * (0.4 + 0.6 * Math.sqrt(progress));
  if (style === 'fire') glow(f, X, Y, r, 'fire', 1 - progress);
  else if (style === 'death') glow(f, X, Y, v.radius * f.px * (1 - progress * 0.7), 'death', 0.8 * (1 - progress));
  else {
    f.ctx.globalAlpha = 0.7 * (1 - progress);
    f.ctx.strokeStyle = PALETTES[style].main;
    f.ctx.lineWidth = Math.max(2, f.px * 0.08 * (1 - progress));
    f.ctx.beginPath();
    f.ctx.arc(X, Y, r, 0, Math.PI * 2);
    f.ctx.stroke();
    f.ctx.globalAlpha = 1;
  }
}

function drawCone(f: Frame, v: SpellVisual, style: ElementStyle, progress: number): void {
  const { ctx } = f;
  const X = sx(f, v.x1);
  const Y = sy(f, v.y1);
  const angle = v.angle ?? 0;
  const spread = v.spread ?? 0.5;
  // The blast thins out as it spreads: strong at the hands, fading towards the edge.
  const reach = v.radius * f.px * (0.5 + 0.5 * progress);
  const fill = ctx.createRadialGradient(X, Y, 0, X, Y, reach);
  fill.addColorStop(0, PALETTES[style].core);
  fill.addColorStop(0.5, PALETTES[style].main);
  fill.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.45 * (1 - progress);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(X, Y);
  ctx.arc(X, Y, reach, angle - spread, angle + spread);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  if (!burstsSeen.has(v)) {
    burstsSeen.add(v);
    // Air cones are wind: pale streaks of mist rather than sparks.
    for (let i = 0; i < 24; i++) {
      const a = angle + (Math.random() * 2 - 1) * spread;
      const speed = v.radius * (2.5 + Math.random() * 2);
      particles.add({
        x: v.x1,
        y: v.y1,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        gravity: 0,
        drag: 0.05,
        life: 0.35,
        size: 0.06,
        grow: 0.15,
        kind: style === 'ice' ? 'shard' : 'blob',
        style: style === 'lightning' ? 'ice' : style,
      });
    }
  }
}

function drawChain(f: Frame, v: SpellVisual, style: ElementStyle, fade: number): void {
  const points = v.points ?? [];
  f.ctx.globalAlpha = fade;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    jagged(f, sx(f, a.x), sy(f, a.y), sx(f, b.x), sy(f, b.y), PALETTES[style].main, Math.max(2, f.px * 0.12), 0.45);
    jagged(f, sx(f, a.x), sy(f, a.y), sx(f, b.x), sy(f, b.y), PALETTES[style].core, Math.max(1, f.px * 0.04), 0.3);
  }
  f.ctx.globalAlpha = 1;
  if (!burstsSeen.has(v)) {
    burstsSeen.add(v);
    for (const p of points.slice(1)) emit(particles, style, p.x, p.y, undefined, 5);
  }
}

function drawVisual(f: Frame, v: SpellVisual): void {
  const style = styleOf(v.spellId);
  const total = v.total ?? 0.18;
  const progress = 1 - v.left / total;
  const fade = Math.min(1, v.left / (total * 0.6));
  if (v.shape === 'beam') drawBeam(f, v, style, fade);
  else if (v.shape === 'chain') drawChain(f, v, style, fade);
  else if (v.shape === 'cone') drawCone(f, v, style, progress);
  else if (v.shape === 'burst') drawBurst(f, v, style, progress);
  else if (v.shape === 'mark' && !burstsSeen.has(v)) {
    burstsSeen.add(v);
    emit(particles, style, v.x1, v.y1, undefined, 8);
  }
}

/** Lingering clouds: the ground under them, plus the element rising or settling in it. */
function drawCloud(f: Frame, cloud: SpellCloud): void {
  const style = styleOf(cloud.spellId);
  const fadeIn = Math.min(1, cloud.left * 2);
  const X = sx(f, cloud.x);
  const Y = sy(f, cloud.y);
  const r = cloud.radius * f.px;
  const ground = f.ctx.createRadialGradient(X, Y, 0, X, Y, r);
  ground.addColorStop(0, mix(PALETTES[style].main, PALETTES[style].fade, 0.3));
  ground.addColorStop(1, 'rgba(0,0,0,0)');
  f.ctx.globalAlpha = 0.35 * fadeIn;
  f.ctx.fillStyle = ground;
  f.ctx.beginPath();
  f.ctx.arc(X, Y, r, 0, Math.PI * 2);
  f.ctx.fill();
  f.ctx.globalAlpha = 1;
  const puffs = chance(f, 10 + cloud.radius * cloud.radius * 14);
  for (let i = 0; i < puffs; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * cloud.radius;
    emit(particles, style, cloud.x + Math.cos(a) * d, cloud.y + Math.sin(a) * d);
  }
  if (style === 'lightning' && Math.random() < f.dt * 3) {
    // A storm cloud now and then lets a bolt fall inside it.
    const a = Math.random() * Math.PI * 2;
    const tx = X + Math.cos(a) * r * 0.6;
    const ty = Y + Math.sin(a) * r * 0.6;
    jagged(f, tx, ty - f.px * 1.2, tx, ty, PALETTES.lightning.core, Math.max(1, f.px * 0.05), 0.3);
  }
}

function drawOngoing(f: Frame, effect: SpellOngoing): void {
  const style = styleOf(effect.spellId);
  const X = sx(f, effect.x);
  const Y = sy(f, effect.y);
  const { ctx } = f;
  if (effect.kind === 'aura') {
    // A ring of the element circling the hero.
    const n = Math.round(effect.radius * 6);
    for (let i = 0; i < n; i++) {
      const a = f.time * 2.4 + (i / n) * Math.PI * 2;
      const x = effect.x + Math.cos(a) * effect.radius;
      const y = effect.y + Math.sin(a) * effect.radius;
      if (Math.random() < f.dt * 12) emit(particles, style, x, y);
      if (style === 'lightning' && Math.random() < f.dt * 4) {
        jagged(f, X, Y, sx(f, x), sy(f, y), PALETTES.lightning.core, Math.max(1, f.px * 0.04), 0.3);
      }
    }
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = PALETTES[style].main;
    ctx.lineWidth = Math.max(1, f.px * 0.05);
    ctx.beginPath();
    ctx.arc(X, Y, effect.radius * f.px, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else if (effect.kind === 'delayed') {
    // The warning circle fills in as the blast draws near; light gathers above it.
    const progress = 1 - effect.left / effect.total;
    const r = effect.radius * f.px;
    ctx.globalAlpha = 0.2 + 0.15 * Math.sin(f.time * 12);
    ctx.fillStyle = PALETTES[style].main;
    ctx.beginPath();
    ctx.arc(X, Y, r * progress, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = PALETTES[style].core;
    ctx.lineWidth = Math.max(1, f.px * 0.05);
    ctx.setLineDash([f.px * 0.25, f.px * 0.15]);
    ctx.beginPath();
    ctx.arc(X, Y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (Math.random() < f.dt * 20) emit(particles, style, effect.x + (Math.random() - 0.5) * effect.radius, effect.y - 1.5 * progress);
  } else if (effect.kind === 'field' && style === 'ice') {
    // Snow drifts down across the sight.
    for (let i = chance(f, 40); i > 0; i--) {
      particles.add({
        x: effect.x + (Math.random() - 0.5) * 16,
        y: effect.y - 8 + Math.random() * 6,
        vx: 0.4,
        vy: 1.2,
        gravity: 0,
        drag: 0.9,
        life: 2,
        size: 0.04,
        grow: 0,
        kind: 'twinkle',
        style: 'ice',
      });
    }
  }
}

/** Spells under the HUD: clouds first, then ongoing effects, shots, flashes, and the particles on top. */
export function drawSpellFx(ctx: CanvasRenderingContext2D, w: World, ox: number, oy: number, px: number, between: number): void {
  const dt = particles.update(w.time, w.grid);
  const f: Frame = { ctx, ox, oy, px, time: w.time, dt };
  for (const cloud of w.spellClouds) drawCloud(f, cloud);
  for (const effect of w.spellOngoing) drawOngoing(f, effect);
  for (const visual of w.spellVisuals) drawVisual(f, visual);
  for (const shot of w.spellShots) drawShot(f, shot, between);
  particles.draw(ctx, ox, oy, px);
  // Ongoing quakes and storms show through their bursts; earthquake dust rises from each monster it shook.
  for (const visual of w.spellVisuals) {
    if (visual.shape !== 'field' || burstsSeen.has(visual)) continue;
    burstsSeen.add(visual);
    const style = styleOf(visual.spellId);
    if (style !== 'earth') continue;
    for (const m of w.monsters) if (w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]) blast(particles, style, m.x, m.y + 0.3, 0.5);
  }
}
