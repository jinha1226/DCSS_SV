import { HERO } from '../data/hero';
import { moveCircle } from './collide';
import { KNOCK_FADE, heroStrikes } from './combat';
import { shove } from './crowd';
import { makeFlow, updateFlow } from './flow';
import { computeFov } from './fov';
import { thinkMonster } from './monster';
import { makeRng } from './rng';
import type { Floor } from './testFloor';
import type { Input, World } from './types';
import { arrive, placeBands } from './waves';

export type { Hero, Input, Monster, SimEvent, World } from './types';

/** The rules move in steps of this many seconds, whatever the screen's refresh rate. */
export const STEP = 1 / 60;

export interface WorldOptions {
  readonly seed?: number;
  /** Cells the hero walks in a second. */
  readonly speed?: number;
  /** False for an empty floor to walk about on. */
  readonly monsters?: boolean;
}

export function makeWorld(floor: Floor, options: WorldOptions = {}): World {
  const size = floor.grid.w * floor.grid.h;
  const { x, y } = floor.start;
  const world: World = {
    grid: floor.grid,
    rooms: floor.rooms,
    hero: { x, y, px: x, py: y, facing: -1, moving: false, hp: HERO.hp, maxHp: HERO.hp, swing: 0, butt: 0, hurt: 0 },
    monsters: [],
    flow: makeFlow(floor.grid),
    visible: new Uint8Array(size),
    seen: new Uint8Array(size),
    rng: makeRng(options.seed ?? 1),
    events: [],
    time: 0,
    speed: options.speed ?? HERO.speed,
    kills: 0,
    nextWave: Infinity,
    over: false,
  };
  look(world);
  if (options.monsters !== false) placeBands(world);
  return world;
}

/** Works out again what the hero sees and how far every cell is from it. */
function look(w: World): void {
  const cx = Math.floor(w.hero.x);
  const cy = Math.floor(w.hero.y);
  computeFov(w.grid, cx, cy, HERO.sight, w.visible);
  for (let i = 0; i < w.visible.length; i++) if (w.visible[i]) w.seen[i] = 1;
  updateFlow(w.flow, w.grid, cx, cy);
}

function walkHero(w: World, input: Input, dt: number): void {
  const hero = w.hero;
  let { mx, my } = input;
  const length = Math.hypot(mx, my);
  if (length > 1) {
    mx /= length;
    my /= length;
  }
  hero.moving = length > 0;
  if (!hero.moving) return;
  const to = moveCircle(w.grid, hero, HERO.radius, mx * w.speed * dt, my * w.speed * dt);
  hero.x = to.x;
  hero.y = to.y;
  if (mx < -0.15) hero.facing = -1;
  else if (mx > 0.15) hero.facing = 1;
}

function walkMonsters(w: World, dt: number): void {
  const wants = w.monsters.map((m) => thinkMonster(w, m, dt));
  if (w.over) return;
  const push = shove(w);
  const fade = Math.exp(-KNOCK_FADE * dt);
  w.monsters.forEach((m, i) => {
    const want = wants[i]!;
    m.px = m.x;
    m.py = m.y;
    // A monster does not press into the bodies it is already squeezed against: that part of
    // its stride is dropped, so it slips along the pack's edge and a pack spreads round the hero.
    const sx = push.x[i]!;
    const sy = push.y[i]!;
    const squeeze = Math.hypot(sx, sy);
    if (squeeze > 1e-5) {
      const into = (want.vx * sx + want.vy * sy) / squeeze;
      if (into < 0) {
        want.vx -= (into * sx) / squeeze;
        want.vy -= (into * sy) / squeeze;
      }
    }
    const dx = (want.vx + m.kx) * dt + sx;
    const dy = (want.vy + m.ky) * dt + sy;
    m.kx *= fade;
    m.ky *= fade;
    if (dx === 0 && dy === 0) return;
    const to = moveCircle(w.grid, m, m.stats.radius, dx, dy);
    m.x = to.x;
    m.y = to.y;
  });
  if (push.heroX !== 0 || push.heroY !== 0) {
    const to = moveCircle(w.grid, w.hero, HERO.radius, push.heroX, push.heroY);
    w.hero.x = to.x;
    w.hero.y = to.y;
  }
}

/** Moves the world on by `dt` seconds. A world whose hero has fallen stands still. */
export function stepWorld(w: World, input: Input, dt: number = STEP): void {
  w.events.length = 0;
  if (w.over) return;
  const hero = w.hero;
  const cellX = Math.floor(hero.x);
  const cellY = Math.floor(hero.y);
  hero.px = hero.x;
  hero.py = hero.y;
  w.time += dt;

  walkHero(w, input, dt);
  walkMonsters(w, dt);
  if (Math.floor(hero.x) !== cellX || Math.floor(hero.y) !== cellY) look(w);
  if (w.over) return;
  heroStrikes(w, dt);
  arrive(w, dt);
}
