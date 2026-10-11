import type { HeroDefinition } from '../data/hero';
import type { AxeItem } from '../data/items';
import type { MonsterKind, MonsterStats } from '../data/monsters';
import type { Room } from './floor';
import type { Flow } from './flow';
import type { Grid } from './grid';
import type { Rng } from './rng';

export interface SkillChoice {
  readonly id: string;
  readonly name: string;
  readonly from: number;
  readonly to: number;
  readonly line: string;
}
export interface Hero {
  x: number;
  y: number;
  px: number;
  py: number;
  facing: -1 | 1;
  moving: boolean;
  hp: number;
  maxHp: number;
  swing: number;
  butt: number;
  hurt: number;
  poison: number;
  throwing: number;
  level: number;
  xp: number;
  skills: Record<string, number>;
  invulnerable: number;
  lastStandUsed: boolean;
  axeSwings: number;
}
export interface Monster {
  readonly kind: MonsterKind;
  readonly stats: MonsterStats;
  readonly pack: number;
  readonly maxHp: number;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  awake: boolean;
  wind: number;
  rest: number;
  stun: number;
  flit: number;
  fx: number;
  fy: number;
  kx: number;
  ky: number;
  flash: number;
  slow: number;
  slowScale: number;
  burning: number;
  burnDamage: number;
  facing: -1 | 1;
}
export interface Shot {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  readonly damage: number;
  readonly mine: boolean;
  left: number;
  pierce: number;
  readonly returns: boolean;
  returning: boolean;
  readonly hit: Monster[];
}
export interface GroundItem {
  readonly uid: string;
  readonly kind: 'axe' | 'ammo';
  x: number;
  y: number;
  axe?: AxeItem;
  count?: number;
  ignored: boolean;
}
export interface PickupStats {
  offered: number;
  swapped: number;
  throws: number;
  recovered: number;
}
export type SimEvent =
  | { readonly type: 'swing'; readonly x: number; readonly y: number; readonly reach: number }
  | {
      readonly type: 'hit';
      readonly x: number;
      readonly y: number;
      readonly amount: number;
      readonly by: 'axe' | 'horns' | 'throw' | 'thorns';
    }
  | { readonly type: 'brand'; readonly x: number; readonly y: number; readonly amount: number; readonly resisted: boolean }
  | { readonly type: 'kill'; readonly x: number; readonly y: number }
  | { readonly type: 'hurt'; readonly x: number; readonly y: number; readonly amount: number }
  | { readonly type: 'dodge'; readonly x: number; readonly y: number }
  | { readonly type: 'block'; readonly x: number; readonly y: number }
  | { readonly type: 'throw'; readonly x: number; readonly y: number }
  | { readonly type: 'wake'; readonly x: number; readonly y: number }
  | { readonly type: 'floor'; readonly depth: number };
export interface Stairs {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}
export interface World {
  grid: Grid;
  rooms: readonly Room[];
  stairs: readonly Stairs[];
  flow: Flow;
  visible: Uint8Array;
  seen: Uint8Array;
  readonly hero: Hero;
  readonly heroDef: HeroDefinition;
  readonly monsters: Monster[];
  readonly shots: Shot[];
  readonly rng: Rng;
  readonly events: SimEvent[];
  readonly seed: number;
  weapon: AxeItem;
  ammo: number;
  readonly groundItems: GroundItem[];
  pendingPickup: GroundItem | null;
  artefactPlaced: boolean;
  nextItem: number;
  itemsEnabled: boolean;
  readonly pickupStats: PickupStats;
  depth: number;
  time: number;
  floorTime: number;
  speed: number;
  kills: number;
  nextPack: number;
  nextBand: number;
  descending: number;
  pendingChoices: number;
  choosing: readonly SkillChoice[] | null;
  over: boolean;
  won: boolean;
}
export interface Input {
  readonly mx: number;
  readonly my: number;
  readonly throw?: boolean;
}
