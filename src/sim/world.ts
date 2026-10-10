import { moveCircle } from './collide';
import { computeFov } from './fov';
import type { Grid } from './grid';
import type { Floor } from './testFloor';

/** The rules move in steps of this many seconds, whatever the screen's refresh rate. */
export const STEP = 1 / 60;

export const HERO = {
  /** Half the hero's width, in cells. */
  radius: 0.35,
  /** Cells walked in a second. */
  speed: 4.5,
  /** How far the hero sees, in cells: enough to cover a tall screen. Walls cut it short. */
  sight: 20,
} as const;

export interface Hero {
  x: number;
  y: number;
  /** Where the hero was one step ago, so the screen can draw between steps. */
  px: number;
  py: number;
  /** -1 facing left, 1 facing right. */
  facing: -1 | 1;
  /** True while walking this step. */
  moving: boolean;
}

export interface World {
  readonly grid: Grid;
  readonly hero: Hero;
  /** One byte per cell: in sight right now. */
  readonly visible: Uint8Array;
  /** One byte per cell: seen at some time. */
  readonly seen: Uint8Array;
  /** Seconds since the floor began. */
  time: number;
  /** Cells walked in a second; a switch can change it. */
  speed: number;
}

/** What the player asks for in a step: a direction, at most 1 long. */
export interface Input {
  readonly mx: number;
  readonly my: number;
}

export function makeWorld(floor: Floor, speed: number = HERO.speed): World {
  const size = floor.grid.w * floor.grid.h;
  const world: World = {
    grid: floor.grid,
    hero: { x: floor.start.x, y: floor.start.y, px: floor.start.x, py: floor.start.y, facing: -1, moving: false },
    visible: new Uint8Array(size),
    seen: new Uint8Array(size),
    time: 0,
    speed,
  };
  look(world);
  return world;
}

function look(w: World): void {
  computeFov(w.grid, Math.floor(w.hero.x), Math.floor(w.hero.y), HERO.sight, w.visible);
  for (let i = 0; i < w.visible.length; i++) if (w.visible[i]) w.seen[i] = 1;
}

/** Moves the world on by `dt` seconds. */
export function stepWorld(w: World, input: Input, dt: number = STEP): void {
  const hero = w.hero;
  hero.px = hero.x;
  hero.py = hero.y;
  w.time += dt;

  let { mx, my } = input;
  const length = Math.hypot(mx, my);
  if (length > 1) {
    mx /= length;
    my /= length;
  }
  hero.moving = length > 0;
  if (!hero.moving) return;

  const cellX = Math.floor(hero.x);
  const cellY = Math.floor(hero.y);
  const to = moveCircle(w.grid, hero, HERO.radius, mx * w.speed * dt, my * w.speed * dt);
  hero.x = to.x;
  hero.y = to.y;
  if (mx < -0.15) hero.facing = -1;
  else if (mx > 0.15) hero.facing = 1;
  if (Math.floor(hero.x) !== cellX || Math.floor(hero.y) !== cellY) look(w);
}
