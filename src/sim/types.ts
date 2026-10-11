import type { HeroDefinition } from '../data/hero';
import type { ResistName, WeaponItem } from '../data/items';
import type { SpellShape } from '../data/spells';
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
  readonly gain: number;
  readonly cap: number;
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
  mana: number;
  maxMana: number;
  swing: number;
  butt: number;
  hurt: number;
  poison: number;
  throwing: number;
  spellCooldown: number;
  level: number;
  xp: number;
  skills: Record<string, number>;
  invulnerable: number;
  lastStandUsed: boolean;
  axeSwings: number;
  hopCooldown: number;
  hopTime: number;
  hopDuration: number;
  hopFromX: number;
  hopFromY: number;
  hopToX: number;
  hopToY: number;
}
export interface Monster {
  readonly kind: MonsterKind;
  readonly stats: MonsterStats;
  readonly pack: number;
  readonly maxHp: number;
  /** Equipped weapon uses the same items.json definition as the hero. */
  readonly weapon?: WeaponItem;
  mana: number;
  maxMana: number;
  spellCooldown: number;
  guard: number;
  /** Remaining uses of items.json items carried by this monster. */
  itemUses: Record<string, number>;
  x: number;
  y: number;
  px: number;
  py: number;
  hp: number;
  awake: boolean;
  wind: number;
  attackMode: 'melee' | 'ranged' | 'spell' | 'item';
  queuedSpell?: string;
  queuedItem?: string;
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
  readonly arrow?: boolean;
  readonly brand?: string;
  readonly weaponEffect?: string;
  readonly stun?: number;
  readonly sourceMonster?: Monster;
}
export interface SpellShot {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  left: number;
  damage: number;
  pierce: number;
  colour: string;
  readonly hit: Monster[];
  readonly element?: ResistName;
  readonly caster?: 'hero' | 'monster';
  readonly sourceMonster?: Monster;
  hitHero?: boolean;
}
export interface SpellCloud {
  x: number;
  y: number;
  radius: number;
  damage: number;
  left: number;
  tick: number;
  nextTick: number;
  colour: string;
  element?: ResistName;
  readonly caster?: 'hero' | 'monster';
  readonly sourceMonster?: Monster;
}
export interface SpellVisual {
  readonly shape: SpellShape;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly radius: number;
  readonly colour: string;
  left: number;
}
export interface GroundItem {
  readonly uid: string;
  readonly kind: 'axe' | 'ammo' | 'path' | 'book' | 'consumable';
  x: number;
  y: number;
  axe?: WeaponItem;
  count?: number;
  skill?: string;
  school?: string;
  itemId?: string;
  ignored: boolean;
  newPath?: boolean;
}
export type BagItem =
  | { readonly uid: string; readonly kind: 'weapon'; readonly weapon: WeaponItem }
  | { readonly uid: string; readonly kind: 'consumable'; readonly id: string; count: number };
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
      readonly by: 'axe' | 'arrow' | 'spell' | 'horns' | 'headbutt_back' | 'throw' | 'thorns';
    }
  | {
      readonly type: 'elemental';
      readonly x: number;
      readonly y: number;
      readonly amount: number;
      readonly element: ResistName;
      readonly target: 'hero' | 'monster';
    }
  | { readonly type: 'brand'; readonly x: number; readonly y: number; readonly amount: number; readonly resisted: boolean }
  | { readonly type: 'kill'; readonly x: number; readonly y: number; readonly name?: string }
  | { readonly type: 'hurt'; readonly x: number; readonly y: number; readonly amount: number }
  | { readonly type: 'dodge'; readonly x: number; readonly y: number }
  | { readonly type: 'block'; readonly x: number; readonly y: number }
  | { readonly type: 'throw'; readonly x: number; readonly y: number }
  | { readonly type: 'wake'; readonly x: number; readonly y: number; readonly name?: string }
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
  readonly spellShots: SpellShot[];
  readonly spellClouds: SpellCloud[];
  readonly spellVisuals: SpellVisual[];
  readonly rng: Rng;
  readonly events: SimEvent[];
  readonly seed: number;
  weapon: WeaponItem;
  readonly inventory: BagItem[];
  ammo: number;
  readonly groundItems: GroundItem[];
  pendingPickup: GroundItem | null;
  artefactPlaced: boolean;
  nextItem: number;
  itemsEnabled: boolean;
  readonly pickupStats: PickupStats;
  readonly openSkills: Set<string>;
  readonly guaranteedSkills: string[];
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
  readonly hop?: boolean;
  readonly spell?: { readonly id: string; readonly x: number; readonly y: number };
}
