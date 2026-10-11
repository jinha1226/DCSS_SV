import type { SimEvent } from '../sim/world';

/** A number that rises from where a blow landed and fades. */
interface Rising {
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly colour: string;
  readonly big: boolean;
  age: number;
}

/** The axe's stroke: an arc that runs once round the hero. */
interface Stroke {
  readonly reach: number;
  readonly from: number;
  age: number;
}

const RISE = 0.6;
const STROKE = 0.2;
const COLOUR = {
  axe: '#f4ecd6',
  horns: '#ffcf6a',
  headbutt_back: '#ffcf6a',
  throw: '#d2e8ff',
  thorns: '#d8a6ff',
  hurt: '#ff7a6a',
  guard: '#b9dfef',
  brand: '#e6c27a',
  resisted: '#999999',
} as const;

/** What the screen shows of blows given and taken. It only listens to the rules; it never changes them. */
export class Fx {
  private readonly rising: Rising[] = [];
  private readonly strokes: Stroke[] = [];
  private turn = 0;

  /** Takes in what happened in one step of the rules. */
  take(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'hit') {
        this.rising.push({ x: e.x, y: e.y - 0.45, text: String(e.amount), colour: COLOUR[e.by], big: e.by === 'horns', age: 0 });
      } else if (e.type === 'brand') {
        this.rising.push({
          x: e.x,
          y: e.y - 0.4,
          text: e.resisted ? '0' : String(e.amount),
          colour: e.resisted ? COLOUR.resisted : COLOUR.brand,
          big: false,
          age: 0,
        });
      } else if (e.type === 'hurt') {
        this.rising.push({ x: e.x, y: e.y - 0.6, text: `-${e.amount}`, colour: COLOUR.hurt, big: true, age: 0 });
      } else if (e.type === 'dodge' || e.type === 'block') {
        this.rising.push({ x: e.x, y: e.y - 0.55, text: e.type === 'dodge' ? '피함' : '막음', colour: COLOUR.guard, big: false, age: 0 });
      } else if (e.type === 'swing') {
        // Each stroke starts a third of a turn on from the last, so they do not look stamped.
        this.turn = (this.turn + 2.1) % (Math.PI * 2);
        this.strokes.push({ reach: e.reach, from: this.turn, age: 0 });
      }
    }
    if (this.rising.length > 80) this.rising.splice(0, this.rising.length - 80);
  }

  /** Moves the effects on by `dt` seconds. */
  step(dt: number): void {
    for (const r of this.rising) r.age += dt;
    for (const s of this.strokes) s.age += dt;
    while (this.rising.length && this.rising[0]!.age >= RISE) this.rising.shift();
    while (this.strokes.length && this.strokes[0]!.age >= STROKE) this.strokes.shift();
  }

  clear(): void {
    this.rising.length = 0;
    this.strokes.length = 0;
  }

  /** The axe's stroke, drawn round the hero at (cx, cy) in canvas pixels. */
  drawStrokes(ctx: CanvasRenderingContext2D, cx: number, cy: number, px: number): void {
    for (const s of this.strokes) {
      const t = s.age / STROKE;
      const head = s.from + t * Math.PI * 2;
      const tail = head - Math.PI * 0.9;
      const r = (s.reach - 0.22) * px;
      ctx.lineCap = 'round';
      // Three passes, thinner and fainter toward the tail.
      for (let i = 0; i < 3; i++) {
        const a0 = tail + ((head - tail) * i) / 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, head);
        ctx.strokeStyle = `rgba(236, 228, 208, ${(0.16 + i * 0.12) * (1 - t * 0.6)})`;
        ctx.lineWidth = px * (0.1 + i * 0.07);
        ctx.stroke();
      }
    }
  }

  /** The rising numbers. `ox`, `oy` is where the floor's corner sits on the canvas. */
  drawNumbers(ctx: CanvasRenderingContext2D, ox: number, oy: number, px: number, dpr: number): void {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of this.rising) {
      const t = r.age / RISE;
      const size = Math.max(11 * dpr, px * (r.big ? 0.5 : 0.4));
      ctx.font = `700 ${size}px system-ui, sans-serif`;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      const x = ox + r.x * px;
      const y = oy + (r.y - t * 0.7) * px;
      ctx.lineWidth = Math.max(2, size * 0.22);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.strokeText(r.text, x, y);
      ctx.fillStyle = r.colour;
      ctx.fillText(r.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
}
