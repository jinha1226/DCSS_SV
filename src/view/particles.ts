import { mix, PALETTES, type ElementStyle } from './elementStyle';

/**
 * Short-lived specks that give each element its motion: embers rise and turn to smoke,
 * frost drifts and lingers, sparks snap, dust spreads, bubbles rise and pop, wisps curl.
 * They run on game time, so they hang still while the world is paused.
 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Cells per second squared, added to vy (negative rises). */
  readonly gravity: number;
  /** Fraction of speed kept per second. */
  readonly drag: number;
  age: number;
  readonly life: number;
  /** Radius in cells at birth; shrink or grow by `grow` over its life. */
  readonly size: number;
  readonly grow: number;
  readonly style: ElementStyle;
  readonly kind: 'blob' | 'spark' | 'shard' | 'chunk' | 'bubble' | 'wisp' | 'twinkle';
  readonly spin: number;
  readonly seed: number;
}

const MAX = 900;

export class Particles {
  private readonly list: Particle[] = [];
  private lastTime = Number.NaN;
  private lastFloor: unknown;

  /** Advances by the game time that passed since the last frame and returns it; a new floor clears everything. */
  update(time: number, floor: unknown): number {
    if (floor !== this.lastFloor) {
      this.list.length = 0;
      this.lastFloor = floor;
      this.lastTime = time;
    }
    const dt = Number.isNaN(this.lastTime) ? 0 : Math.max(0, Math.min(0.1, time - this.lastTime));
    this.lastTime = time;
    if (dt === 0) return 0;
    let kept = 0;
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      const keep = Math.pow(p.drag, dt);
      p.vx *= keep;
      p.vy = p.vy * keep + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      this.list[kept++] = p;
    }
    this.list.length = kept;
    return dt;
  }

  add(p: Omit<Particle, 'age' | 'seed' | 'spin'> & { spin?: number }): void {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ ...p, age: 0, seed: Math.random() * 1000, spin: p.spin ?? (Math.random() - 0.5) * 8 });
  }

  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number, px: number): void {
    for (const p of this.list) drawParticle(ctx, p, ox + p.x * px, oy + p.y * px, px);
    ctx.globalAlpha = 1;
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, sx: number, sy: number, px: number): void {
  const t = p.age / p.life;
  const palette = PALETTES[p.style];
  const r = Math.max(0.6, (p.size + p.grow * t) * px);
  const alpha = Math.max(0, 1 - t) * (p.kind === 'blob' ? (p.style === 'fire' ? 0.85 : 0.5) : 0.9);
  ctx.globalAlpha = alpha;
  switch (p.kind) {
    case 'blob':
      // Embers cool from white-yellow through the main colour to smoke; mist and dust just fade.
      // A faint halo keeps the edge soft, so dust and mist read as clouds rather than discs.
      ctx.fillStyle = t < 0.35 ? mix(palette.core, palette.main, t / 0.35) : mix(palette.main, palette.fade, (t - 0.35) / 0.65);
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, r * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    case 'spark':
      ctx.strokeStyle = mix(palette.core, palette.main, t);
      ctx.lineWidth = Math.max(1, r * 0.6);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - p.vx * px * 0.04, sy - p.vy * px * 0.04);
      ctx.stroke();
      return;
    case 'shard': {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.seed + p.spin * p.age);
      ctx.fillStyle = mix(palette.core, palette.main, t);
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.6);
      ctx.lineTo(r * 0.55, 0);
      ctx.lineTo(0, r * 1.6);
      ctx.lineTo(-r * 0.55, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'chunk': {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(p.seed + p.spin * p.age);
      ctx.fillStyle = mix(palette.main, palette.fade, t * 0.6);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const k = 0.7 + 0.3 * Math.sin(p.seed * (i + 1));
        ctx.lineTo(Math.cos(a) * r * k, Math.sin(a) * r * k);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      return;
    }
    case 'bubble':
      ctx.strokeStyle = palette.core;
      ctx.lineWidth = Math.max(1, r * 0.25);
      ctx.fillStyle = palette.main;
      ctx.globalAlpha *= 0.7;
      ctx.beginPath();
      ctx.arc(sx, sy, r * (t > 0.85 ? 1 + (t - 0.85) * 4 : 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      return;
    case 'wisp': {
      // A curling thread: offset sideways by a slow wave.
      const wave = Math.sin(p.seed + p.age * 7) * r * 1.5;
      ctx.strokeStyle = mix(palette.core, palette.main, t);
      ctx.lineWidth = Math.max(1, r * 0.5);
      ctx.beginPath();
      ctx.moveTo(sx + wave, sy);
      ctx.quadraticCurveTo(sx - wave, sy + r * 2, sx + wave * 0.5, sy + r * 4);
      ctx.stroke();
      return;
    }
    case 'twinkle': {
      const pulse = 0.5 + 0.5 * Math.sin(p.seed + p.age * 18);
      ctx.strokeStyle = palette.core;
      ctx.lineWidth = Math.max(1, r * 0.35);
      const k = r * (1 + pulse);
      ctx.beginPath();
      ctx.moveTo(sx - k, sy);
      ctx.lineTo(sx + k, sy);
      ctx.moveTo(sx, sy - k);
      ctx.lineTo(sx, sy + k);
      ctx.stroke();
      return;
    }
  }
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/** One puff of the element's natural movement at a point; `push` is a drift velocity to inherit. */
export function emit(particles: Particles, style: ElementStyle, x: number, y: number, push = { x: 0, y: 0 }, count = 1): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const base = { x: x + rand(-0.08, 0.08), y: y + rand(-0.08, 0.08), style };
    switch (style) {
      case 'fire':
        // Embers rise, flicker sideways, and cool into smoke.
        particles.add({
          ...base,
          vx: push.x * 0.2 + rand(-0.4, 0.4),
          vy: push.y * 0.2 - rand(0.6, 1.4),
          gravity: -1.2,
          drag: 0.3,
          life: rand(0.35, 0.7),
          size: rand(0.08, 0.15),
          grow: 0.06,
          kind: 'blob',
        });
        // Now and then a spark shoots up faster than the flame.
        if (Math.random() < 0.3) {
          particles.add({
            ...base,
            vx: rand(-0.8, 0.8),
            vy: -rand(1.5, 2.5),
            gravity: -0.5,
            drag: 0.6,
            life: rand(0.4, 0.8),
            size: 0.04,
            grow: 0,
            kind: 'spark',
          });
        }
        break;
      case 'ice':
        // Frost hangs in the air and sinks slowly; a few glints.
        particles.add({
          ...base,
          vx: push.x * 0.1 + rand(-0.2, 0.2),
          vy: push.y * 0.1 + rand(-0.1, 0.2),
          gravity: 0.25,
          drag: 0.15,
          life: rand(0.6, 1.1),
          size: rand(0.03, 0.06),
          grow: 0.04,
          kind: Math.random() < 0.3 ? 'twinkle' : 'blob',
        });
        break;
      case 'lightning':
        particles.add({
          ...base,
          vx: Math.cos(a) * rand(3, 7),
          vy: Math.sin(a) * rand(3, 7),
          gravity: 0,
          drag: 0.01,
          life: rand(0.08, 0.18),
          size: 0.05,
          grow: 0,
          kind: 'spark',
        });
        break;
      case 'earth':
        particles.add({
          ...base,
          vx: push.x * 0.15 + Math.cos(a) * rand(0.2, 0.6),
          vy: push.y * 0.15 + Math.sin(a) * rand(0.2, 0.6),
          gravity: 0,
          drag: 0.08,
          life: rand(0.4, 0.8),
          size: rand(0.04, 0.07),
          grow: 0.12,
          kind: 'blob',
        });
        break;
      case 'poison':
        particles.add({
          ...base,
          vx: rand(-0.15, 0.15),
          vy: -rand(0.2, 0.5),
          gravity: -0.1,
          drag: 0.5,
          life: rand(0.5, 0.9),
          size: rand(0.03, 0.06),
          grow: 0.02,
          kind: 'bubble',
        });
        break;
      case 'death':
        particles.add({
          ...base,
          vx: push.x * 0.1 + rand(-0.2, 0.2),
          vy: -rand(0.2, 0.5),
          gravity: -0.2,
          drag: 0.4,
          life: rand(0.5, 0.9),
          size: rand(0.03, 0.05),
          grow: 0.02,
          kind: 'wisp',
        });
        break;
      case 'hex':
      case 'spirit':
        particles.add({
          ...base,
          vx: Math.cos(a) * rand(0.2, 0.6),
          vy: Math.sin(a) * rand(0.2, 0.6),
          gravity: 0,
          drag: 0.2,
          life: rand(0.4, 0.8),
          size: rand(0.03, 0.05),
          grow: 0,
          kind: 'twinkle',
        });
        break;
    }
  }
}

/** An outward blast of the element from a point (bursts, impacts). */
export function blast(particles: Particles, style: ElementStyle, x: number, y: number, radius: number): void {
  const n = Math.round(10 + radius * 14);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
    const speed = radius * rand(2.2, 3.4);
    const vx = Math.cos(a) * speed;
    const vy = Math.sin(a) * speed;
    if (style === 'earth') {
      // Debris is thrown up and falls back down; dust stays behind.
      particles.add({
        x,
        y,
        vx,
        vy: vy - rand(1, 2.5),
        gravity: 6,
        drag: 0.4,
        life: rand(0.4, 0.7),
        size: rand(0.05, 0.1),
        grow: 0,
        kind: 'chunk',
        style,
      });
      if (i % 2 === 0) emit(particles, 'earth', x + Math.cos(a) * radius * 0.5, y + Math.sin(a) * radius * 0.5);
    } else if (style === 'ice') {
      particles.add({
        x,
        y,
        vx,
        vy,
        gravity: 0,
        drag: 0.05,
        life: rand(0.3, 0.5),
        size: rand(0.05, 0.08),
        grow: -0.03,
        kind: 'shard',
        style,
      });
    } else if (style === 'lightning') {
      particles.add({
        x,
        y,
        vx: vx * 2,
        vy: vy * 2,
        gravity: 0,
        drag: 0.01,
        life: rand(0.1, 0.2),
        size: 0.05,
        grow: 0,
        kind: 'spark',
        style,
      });
    } else if (style === 'death') {
      // Necrotic force collapses inwards.
      const r = radius * rand(0.7, 1.1);
      particles.add({
        x: x + Math.cos(a) * r,
        y: y + Math.sin(a) * r,
        vx: -vx * 0.8,
        vy: -vy * 0.8,
        gravity: 0,
        drag: 0.3,
        life: rand(0.3, 0.5),
        size: 0.04,
        grow: 0,
        kind: 'wisp',
        style,
      });
    } else {
      particles.add({
        x,
        y,
        vx: vx * 0.7,
        vy: vy * 0.7 - (style === 'fire' ? 0.8 : 0),
        gravity: style === 'fire' ? -1.5 : 0,
        drag: 0.08,
        life: rand(0.35, 0.6),
        size: rand(0.07, 0.12),
        grow: style === 'fire' ? 0.1 : 0.05,
        kind: style === 'poison' ? 'bubble' : style === 'fire' ? 'blob' : 'twinkle',
        style,
      });
    }
  }
}
