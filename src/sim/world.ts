import { heroFor } from '../data/hero';
import { DUNGEON } from '../data/packs';
import { moveCircle } from './collide';
import { KNOCK_FADE, heroStrikes } from './combat';
import { shove } from './crowd';
import type { Floor } from './floor';
import { makeFlow, updateFlow } from './flow';
import { computeFov } from './fov';
import { makeFloor } from './gen';
import { Cell, cellAt } from './grid';
import { thinkMonster } from './monster';
import { fillFloor, lingering } from './packs';
import { makeRng } from './rng';
import type { Input, Stairs, World } from './types';

export type { Hero, Input, Monster, Shot, SimEvent, Stairs, World } from './types';

/** The rules move in steps of this many seconds, whatever the screen's refresh rate. */
export const STEP = 1 / 60;

export interface WorldOptions {
  readonly seed?: number;
  /** Cells the hero walks in a second. */
  readonly speed?: number;
  /** The floor to start on; 1 unless a switch says otherwise. */
  readonly depth?: number;
  /** A floor laid out by hand, for tests; without one, floors are made from the seed. */
  readonly floor?: Floor;
  readonly species?: string;
  readonly job?: string;
  /** False for an empty floor to walk about on. */
  readonly monsters?: boolean;
}

/** How many more times a step eases overlapping bodies apart after they have walked. */
const SETTLE = 2;

/** The seed of one floor of a run: the same run always has the same floors. */
export const floorSeed = (seed: number, depth: number): number => (Math.imul(seed, 2654435761) + depth * 97) >>> 0;

function stairsOf(floor: Floor): Stairs[] {
  const out: Stairs[] = [];
  const { grid } = floor;
  for (let y = 0; y < grid.h; y++) {
    for (let x = 0; x < grid.w; x++) {
      const c = cellAt(grid, x, y);
      if (c === Cell.StairsDown || c === Cell.StairsUp) out.push({ x, y, down: c === Cell.StairsDown });
    }
  }
  return out;
}

/** Lays a floor under the hero's feet and, unless told not to, fills it with sleeping bands. */
function enter(w: World, floor: Floor, monsters: boolean): void {
  const size = floor.grid.w * floor.grid.h;
  w.grid = floor.grid;
  w.rooms = floor.rooms;
  w.stairs = stairsOf(floor);
  w.flow = makeFlow(floor.grid);
  w.visible = new Uint8Array(size);
  w.seen = new Uint8Array(size);
  w.monsters.length = 0;
  w.shots.length = 0;
  w.floorTime = 0;
  w.descending = 0;
  w.nextBand = Infinity;
  const hero = w.hero;
  hero.x = hero.px = floor.start.x;
  hero.y = hero.py = floor.start.y;
  look(w);
  if (monsters) fillFloor(w);
}

export function makeWorld(options: WorldOptions = {}): World {
  const seed = options.seed ?? 1;
  const depth = Math.min(DUNGEON.floors, Math.max(1, options.depth ?? 1));
  const floor = options.floor ?? makeFloor(floorSeed(seed, depth));
  const heroDef = heroFor(options.species, options.job);
  const world: World = {
    grid: floor.grid,
    rooms: floor.rooms,
    stairs: [],
    flow: makeFlow(floor.grid),
    visible: new Uint8Array(0),
    seen: new Uint8Array(0),
    hero: { x: 0, y: 0, px: 0, py: 0, facing: -1, moving: false, hp: heroDef.hp, maxHp: heroDef.hp, swing: 0, butt: 0, hurt: 0, poison: 0, throwing: 0 },
    heroDef,
    monsters: [],
    shots: [],
    rng: makeRng(seed ^ 0x5bd1e995),
    events: [],
    seed,
    depth,
    time: 0,
    floorTime: 0,
    speed: options.speed ?? heroDef.speed,
    kills: 0,
    nextPack: 1,
    nextBand: Infinity,
    descending: 0,
    over: false,
    won: false,
  };
  enter(world, floor, options.monsters !== false);
  return world;
}

/** Works out again what the hero sees and how far every cell is from it. */
function look(w: World): void {
  const cx = Math.floor(w.hero.x);
  const cy = Math.floor(w.hero.y);
  computeFov(w.grid, cx, cy, w.heroDef.sight, w.visible);
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
  const to = moveCircle(w.grid, hero, w.heroDef.radius, mx * w.speed * dt, my * w.speed * dt);
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
  shoveHero(w, push.heroX, push.heroY);
  // Once is not enough in a crush: bodies still overlapping are eased apart again.
  for (let pass = 0; pass < SETTLE; pass++) {
    const more = shove(w);
    w.monsters.forEach((m, i) => {
      const sx = more.x[i]!;
      const sy = more.y[i]!;
      if (sx === 0 && sy === 0) return;
      const to = moveCircle(w.grid, m, m.stats.radius, sx, sy);
      m.x = to.x;
      m.y = to.y;
    });
    shoveHero(w, more.heroX, more.heroY);
  }
}

function shoveHero(w: World, dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  const to = moveCircle(w.grid, w.hero, w.heroDef.radius, dx, dy);
  w.hero.x = to.x;
  w.hero.y = to.y;
}

/** Standing on a way down takes it after a moment; the last floor's way down leads out. */
function stairsUnderfoot(w: World, dt: number): void {
  const onStairs = cellAt(w.grid, Math.floor(w.hero.x), Math.floor(w.hero.y)) === Cell.StairsDown;
  w.descending = onStairs ? w.descending + dt : 0;
  if (w.descending < DUNGEON.descend) return;
  if (w.depth >= DUNGEON.floors) {
    w.over = true;
    w.won = true;
    return;
  }
  w.depth++;
  enter(w, makeFloor(floorSeed(w.seed, w.depth)), true);
  w.events.push({ type: 'floor', depth: w.depth });
}

/** Moves the world on by `dt` seconds. A world whose run has ended stands still. */
export function stepWorld(w: World, input: Input, dt: number = STEP): void {
  w.events.length = 0;
  if (w.over) return;
  const hero = w.hero;
  const cellX = Math.floor(hero.x);
  const cellY = Math.floor(hero.y);
  hero.px = hero.x;
  hero.py = hero.y;
  w.time += dt;
  w.floorTime += dt;

  walkHero(w, input, dt);
  walkMonsters(w, dt);
  if (Math.floor(hero.x) !== cellX || Math.floor(hero.y) !== cellY) look(w);
  if (w.over) return;
  heroStrikes(w, dt, input.throw === true);
  if (w.over) return;
  lingering(w, dt);
  stairsUnderfoot(w, dt);
}
