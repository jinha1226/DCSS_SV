import * as THREE from 'three';
import type { Monster, World } from '../sim/world';
import type { Fx } from '../view/fx';

/** Anything placed over the 3D picture: numbers, bars, arrows to unseen foes, flashes and banners. */
export class Overlay {
  private banner?: { title: string; sub: string; colour: string; age: number; life: number };
  private hurtFlash = 0;
  private readonly v = new THREE.Vector3();

  constructor(private readonly camera: THREE.Camera) {}

  /** A big line of text across the middle of the screen, e.g. LEVEL UP. */
  announce(title: string, sub: string, colour: string, life = 2.2): void {
    this.banner = { title, sub, colour, age: 0, life };
  }

  /** Drops any banner now showing. */
  quiet(): void {
    this.banner = undefined;
  }

  hurt(amount: number): void {
    this.hurtFlash = Math.min(1, this.hurtFlash + 0.35 + amount * 0.04);
  }

  step(dt: number): void {
    if (this.banner) {
      this.banner.age += dt;
      if (this.banner.age >= this.banner.life) this.banner = undefined;
    }
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.4);
  }

  /** Where a world point (x across, height, y down the floor) lands on the canvas, or undefined behind the camera. */
  private screen(x: number, height: number, y: number, width: number, h: number): { x: number; y: number } | undefined {
    this.v.set(x, height, y).project(this.camera);
    if (this.v.z > 1) return undefined;
    return { x: (this.v.x * 0.5 + 0.5) * width, y: (-this.v.y * 0.5 + 0.5) * h };
  }

  draw(ctx: CanvasRenderingContext2D, w: World, fx: Fx, dpr: number, between: number, heights: (m: Monster) => number): void {
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    this.drawBars(ctx, w, dpr, between, heights, width, height);
    this.drawNumbers(ctx, fx, dpr, width, height);
    this.drawThreats(ctx, w, dpr, width, height);
    this.drawHurt(ctx, width, height);
    this.drawBanner(ctx, dpr, width, height);
  }

  private drawBars(
    ctx: CanvasRenderingContext2D,
    w: World,
    dpr: number,
    between: number,
    heights: (m: Monster) => number,
    width: number,
    height: number,
  ): void {
    for (const m of w.monsters) {
      if (m.hp <= 0 || !w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]) continue;
      const x = m.px + (m.x - m.px) * between;
      const y = m.py + (m.y - m.py) * between;
      const p = this.screen(x, heights(m) + 0.18, y, width, height);
      if (!p) continue;
      if (!m.awake) {
        ctx.font = `700 ${Math.round(13 * dpr)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(214, 226, 255, 0.9)';
        const bob = Math.sin(performance.now() / 400 + x) * 3 * dpr;
        ctx.fillText('z', p.x + 6 * dpr, p.y - 4 * dpr + bob);
        ctx.font = `700 ${Math.round(9 * dpr)}px system-ui, sans-serif`;
        ctx.fillText('z', p.x + 13 * dpr, p.y - 13 * dpr + bob);
      }
      if (m.hp >= m.maxHp) continue;
      const bw = Math.round(34 * dpr);
      const bh = Math.max(3, Math.round(4 * dpr));
      const bx = Math.round(p.x - bw / 2);
      const by = Math.round(p.y);
      ctx.fillStyle = 'rgba(8, 6, 6, 0.8)';
      ctx.fillRect(bx - dpr, by - dpr, bw + 2 * dpr, bh + 2 * dpr);
      const share = Math.max(0, m.hp / m.maxHp);
      ctx.fillStyle = share > 0.5 ? '#d2483a' : share > 0.25 ? '#e0772e' : '#f0b33a';
      ctx.fillRect(bx, by, Math.round(bw * share), bh);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(bx, by, Math.round(bw * share), Math.max(1, Math.round(bh / 3)));
    }
  }

  private drawNumbers(ctx: CanvasRenderingContext2D, fx: Fx, dpr: number, width: number, height: number): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fx.forEachNumber((n, t) => {
      const p = this.screen(n.x, 1.25 + t * 0.9, n.y + 0.5, width, height);
      if (!p) return;
      // Pops in large, settles, then fades.
      const pop = t < 0.12 ? 1.55 - (t / 0.12) * 0.55 : 1;
      const size = Math.round((n.big ? 22 : 17) * dpr * pop);
      ctx.font = `900 ${size}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.globalAlpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
      ctx.lineWidth = Math.max(2, size * 0.2);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(10, 6, 4, 0.9)';
      ctx.strokeText(n.text, p.x, p.y);
      ctx.fillStyle = n.colour;
      ctx.fillText(n.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;
  }

  /** Arrowheads at the screen edge pointing at awake foes out of sight. */
  private drawThreats(ctx: CanvasRenderingContext2D, w: World, dpr: number, width: number, height: number): void {
    const sectors = new Set<number>();
    for (const m of w.monsters) {
      const cell = Math.floor(m.y) * w.grid.w + Math.floor(m.x);
      if (!m.awake || m.hp <= 0 || w.visible[cell]) continue;
      sectors.add(Math.round(Math.atan2(m.y - w.hero.y, m.x - w.hero.x) / (Math.PI / 4)));
    }
    const rx = width / 2 - 22 * dpr;
    const ry = height / 2 - 120 * dpr;
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 180);
    ctx.fillStyle = `rgba(232, 92, 70, ${0.85 * pulse})`;
    for (const s of sectors) {
      const a = s * (Math.PI / 4);
      ctx.save();
      ctx.translate(width / 2 + Math.cos(a) * rx, height / 2 + Math.sin(a) * ry);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(9 * dpr, 0);
      ctx.lineTo(-6 * dpr, -6 * dpr);
      ctx.lineTo(-3 * dpr, 0);
      ctx.lineTo(-6 * dpr, 6 * dpr);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawHurt(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.hurtFlash <= 0) return;
    const g = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.3,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    g.addColorStop(0, 'rgba(160, 20, 10, 0)');
    g.addColorStop(1, `rgba(170, 18, 8, ${0.55 * this.hurtFlash})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }

  private drawBanner(ctx: CanvasRenderingContext2D, dpr: number, width: number, height: number): void {
    const b = this.banner;
    if (!b) return;
    const t = b.age / b.life;
    const appear = Math.min(1, b.age / 0.25);
    const alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : appear;
    const y = height * 0.3;
    ctx.save();
    ctx.globalAlpha = alpha;
    const band = ctx.createLinearGradient(0, 0, width, 0);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.5, 'rgba(10,8,6,0.72)');
    band.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, y - 46 * dpr, width, 92 * dpr);
    const scale = 1 + (1 - appear) * 0.5;
    ctx.translate(width / 2, y);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(34 * dpr)}px Georgia, "Times New Roman", serif`;
    ctx.shadowColor = b.colour;
    ctx.shadowBlur = 18 * dpr;
    ctx.fillStyle = b.colour;
    ctx.fillText(b.title, 0, -8 * dpr);
    ctx.shadowBlur = 0;
    ctx.font = `600 ${Math.round(13 * dpr)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(240, 230, 210, 0.92)';
    ctx.fillText(b.sub, 0, 22 * dpr);
    ctx.restore();
  }
}
