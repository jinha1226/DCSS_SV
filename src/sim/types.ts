import type { MonsterKind, MonsterStats } from '../data/monsters';
import type { Flow } from './flow';
import type { Grid } from './grid';
import type { Rng } from './rng';
import type { Room } from './testFloor';

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
}

export interface Monster {
  readonly kind: MonsterKind;
  readonly stats: MonsterStats;
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
  /** The speed it is being thrown back at, in cells a second. */
  kx: number;
  ky: number;
  /** Seconds it still shows it was just struck. */
  flash: number;
  facing: -1 | 1;
}

/** What happened in a step, for the screen to show. The rules never read these back. */
export type SimEvent =
  | { readonly type: 'swing'; readonly x: number; readonly y: number; readonly reach: number }
  | { readonly type: 'hit'; readonly x: number; readonly y: number; readonly amount: number; readonly by: 'axe' | 'horns' }
  | { readonly type: 'kill'; readonly x: number; readonly y: number }
  | { readonly type: 'hurt'; readonly x: number; readonly y: number; readonly amount: number };

export interface World {
  readonly grid: Grid;
  readonly rooms: readonly Room[];
  readonly hero: Hero;
  readonly monsters: Monster[];
  readonly flow: Flow;
  /** One byte per cell: in sight right now. */
  readonly visible: Uint8Array;
  /** One byte per cell: seen at some time. */
  readonly seen: Uint8Array;
  readonly rng: Rng;
  /** Cleared at the start of every step. */
  readonly events: SimEvent[];
  /** Seconds since the floor began. */
  time: number;
  /** Cells walked in a second; a switch can change it. */
  speed: number;
  kills: number;
  /** Seconds until the next band arrives. */
  nextWave: number;
  /** True once the hero has fallen; the world stands still from then on. */
  over: boolean;
}

/** What the player asks for in a step: a direction, at most 1 long. */
export interface Input {
  readonly mx: number;
  readonly my: number;
}
