import type { HeroDefinition } from '../data/hero';
import type { MonsterKind, MonsterStats } from '../data/monsters';
import type { Room } from './floor';
import type { Flow } from './flow';
import type { Grid } from './grid';
import type { Rng } from './rng';

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
  hp: number;
  maxHp: number;
  /** Seconds until the axe may swing again. */
  swing: number;
  /** Seconds until the horns may butt again. */
  butt: number;
  /** Seconds the hero still shows it was just struck. */
  hurt: number;
  /** Seconds of poison left. */
  poison: number;
  /** Seconds until the next throw may be made. */
  throwing: number;
}

export interface Monster {
  readonly kind: MonsterKind;
  readonly stats: MonsterStats;
  /** The band it belongs to: one waking wakes the rest. */
  readonly pack: number;
  readonly maxHp: number;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  /** A monster that has not noticed the hero stands where it is. */
  awake: boolean;
  /** Seconds left of drawing back for a blow, or below zero when not striking. */
  wind: number;
  /** Seconds until it may strike again. */
  rest: number;
  /** Seconds it still stands dazed. */
  stun: number;
  /** Seconds it still darts off after a blow, and which way. */
  flit: number;
  fx: number;
  fy: number;
  /** The speed it is being thrown back at, in cells a second. */
  kx: number;
  ky: number;
  /** Seconds it still shows it was just struck. */
  flash: number;
  facing: -1 | 1;
}

/** Something thrown, in the air. */
export interface Shot {
  x: number;
  y: number;
  px: number;
  py: number;
  readonly vx: number;
  readonly vy: number;
  readonly damage: number;
  /** True for the hero's own throw; a monster's stone otherwise. */
  readonly mine: boolean;
  /** Seconds before it drops. */
  left: number;
}

/** What happened in a step, for the screen to show. The rules never read these back. */
export type SimEvent =
  | { readonly type: 'swing'; readonly x: number; readonly y: number; readonly reach: number }
  | { readonly type: 'hit'; readonly x: number; readonly y: number; readonly amount: number; readonly by: 'axe' | 'horns' | 'throw' }
  | { readonly type: 'kill'; readonly x: number; readonly y: number }
  | { readonly type: 'hurt'; readonly x: number; readonly y: number; readonly amount: number }
  | { readonly type: 'throw'; readonly x: number; readonly y: number }
  | { readonly type: 'wake'; readonly x: number; readonly y: number }
  | { readonly type: 'floor'; readonly depth: number };

export interface Stairs {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}

export interface World {
  /** The floor underfoot. Replaced, with what follows it, on the way down. */
  grid: Grid;
  rooms: readonly Room[];
  stairs: readonly Stairs[];
  flow: Flow;
  /** One byte per cell: in sight right now. */
  visible: Uint8Array;
  /** One byte per cell: seen at some time. */
  seen: Uint8Array;

  readonly hero: Hero;
  readonly heroDef: HeroDefinition;
  readonly monsters: Monster[];
  readonly shots: Shot[];
  readonly rng: Rng;
  /** Cleared at the start of every step. */
  readonly events: SimEvent[];
  readonly seed: number;
  /** 1 for the first floor. */
  depth: number;
  /** Seconds since the run began, and since this floor began. */
  time: number;
  floorTime: number;
  /** Cells walked in a second; a switch can change it. */
  speed: number;
  kills: number;
  /** The number the next band to be made will carry. */
  nextPack: number;
  /** Seconds until the next band comes up the stairs. */
  nextBand: number;
  /** Seconds the hero has stood on a way down. */
  descending: number;
  /** True once the hero has fallen or got out; the world stands still from then on. */
  over: boolean;
  /** True if the run ended by getting out. */
  won: boolean;
}

/** What the player asks for in a step: a direction, at most 1 long, and whether to throw. */
export interface Input {
  readonly mx: number;
  readonly my: number;
  readonly throw?: boolean;
}
