import type { Branch, DungeonGraph } from './dungeonGraph';
import type { HeroDefinition } from '../data/hero';
import type { ResistName, WeaponItem } from '../data/items';
import type { SpellShape } from '../data/spells';
import type { MonsterKind, MonsterStats } from '../data/monsters';
import type { Room } from './floor';
import type { Flow } from './flow';
import type { Grid } from './grid';
import type { Rng } from './rng';

export interface ItemChoice {
  readonly id: string;
  readonly kind: 'weapon' | 'gear' | 'consumable';
  readonly name: string;
  readonly line: string;
  readonly weapon?: WeaponItem;
  readonly itemId?: string;
}

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
  constricted: number;
  throwing: number;
  /** Short shared pause after any button spell. */
  spellCooldown: number;
  /** Time until the staff or rod fires its automatic spell again. */
  autoCooldown: number;
  /** Seconds left per button spell id; entries vanish at zero. */
  spellCooldowns: Record<string, number>;
  /** Spell ids the player pinned to the four button slots; empty slots fill themselves. */
  spellSlots: (string | undefined)[];
  level: number;
  xp: number;
  skills: Record<string, number>;
  /** Progress towards each next skill level; persists across equipment changes and floors. */
  skillXp: Record<string, number>;
  invulnerable: number;
  lastStandUsed: boolean;
  might: number;
  haste: number;
  /** Spell buffs: seconds left and strength (armour points, speed share). */
  armourBuff: number;
  armourBuffPower: number;
  speedBuff: number;
  speedBuffPower: number;
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
  /** Deadline pursuit enemies grant no XP or kill-triggered healing. */
  rewardless?: boolean;
  /** Equipped weapon uses the same items.json definition as the hero. */
  readonly weapon?: WeaponItem;
  mana: number;
  maxMana: number;
  spellCooldown: number;
  guard: number;
  fear: number;
  confusion: number;
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
  /** Spell afflictions: seconds left and strength. */
  vulnerable: number;
  vulnerableScale: number;
  rot: number;
  rotArmour: number;
  rotDamage: number;
  poison: number;
  poisonDamage: number;
  /** Time until poison and rot deal their next damage. */
  afflictionTick: number;
  /** A spell mark that goes off when this monster dies. */
  mark?: { readonly spellId: string; left: number; readonly damage: number };
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
  /** Spell whose rider effects this shot carries. */
  readonly spellId?: string;
  /** Homing shots steer towards this monster while it lives. */
  homingTarget?: Monster;
  /** Countdown to the next zap (ball lightning) and the next trail flame (lava lance). */
  zapTimer?: number;
  trailTimer?: number;
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
  readonly spellId?: string;
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
  /** Lets the view draw the spell's element (flame, frost, lightning...). */
  readonly spellId?: string;
  /** Chain jumps, in order. */
  readonly points?: readonly { readonly x: number; readonly y: number }[];
  /** Cone: facing angle and half-width in radians. */
  readonly angle?: number;
  readonly spread?: number;
  /** Seconds the visual lasts in total, for drawing its progress. */
  readonly total?: number;
}
/** Spells that keep working after the cast: auras, storms, delayed blasts and whole-sight fields. */
export interface SpellOngoing {
  readonly kind: 'aura' | 'storm' | 'delayed' | 'field';
  readonly spellId: string;
  x: number;
  y: number;
  readonly radius: number;
  readonly damage: number;
  readonly total: number;
  left: number;
  readonly tick: number;
  nextTick: number;
}
export interface GroundItem {
  readonly uid: string;
  readonly kind: 'axe' | 'ammo' | 'consumable' | 'gear' | 'gold';
  x: number;
  y: number;
  axe?: WeaponItem;
  count?: number;
  itemId?: string;
  ignored: boolean;
}
export type BagItem =
  | { readonly uid: string; readonly kind: 'weapon'; readonly weapon: WeaponItem }
  | { readonly uid: string; readonly kind: 'consumable'; readonly id: string; count: number }
  | { readonly uid: string; readonly kind: 'gear'; readonly id: string };
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
  | { readonly type: 'floor'; readonly depth: number }
  | { readonly type: 'rune'; readonly branch: Branch }
  | { readonly type: 'orb' }
  /** Something walked over and taken without asking: gold, gear, a consumable, or thrown ammo back. */
  | {
      readonly type: 'pickup';
      readonly x: number;
      readonly y: number;
      readonly item: 'gold' | 'gear' | 'consumable' | 'ammo';
      readonly id?: string;
      readonly count: number;
    };
export interface Stairs {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
}
export interface FloorState {
  readonly grid: Grid;
  readonly rooms: readonly Room[];
  readonly seen: Uint8Array;
  readonly monsters: Monster[];
  readonly groundItems: GroundItem[];
  readonly floorTime: number;
  readonly nextBand: number;
  /** One-use-per-floor Last Stand state is restored on revisits. */
  readonly lastStandUsed: boolean;
  readonly returnX: number;
  readonly returnY: number;
}
/** The one upward stair on a child floor returns to its most recent entry stair. */
export interface StairConnection {
  readonly parentDepth: number;
  readonly parentX: number;
  readonly parentY: number;
  readonly childX: number;
  readonly childY: number;
}
export interface ShopOffer {
  readonly uid: string;
  readonly price: number;
  readonly weapon?: WeaponItem;
  readonly itemId?: string;
}
export interface World {
  /** Persistent floors indexed by unique graph node ID. */
  readonly floorStates: Map<number, FloorState>;
  readonly dungeonGraph: DungeonGraph;
  /** Distinct runes collected; populated by stage 5. */
  readonly runes: Set<Branch>;
  orbCollected: boolean;
  gold: number;
  readonly shopStock: ShopOffer[];
  /** Each visited floor retains its own advancing seeded random stream. */
  readonly floorRng: Map<number, Rng>;
  /** Child node -> paired arrival and return stair coordinates. */
  readonly stairConnections: Map<number, StairConnection>;
  /** Whether floor population was enabled when this run started. */
  readonly monstersEnabled: boolean;
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
  readonly spellOngoing: SpellOngoing[];
  /** Marked monsters that died this step, waiting for their mark to go off. */
  readonly markQueue: { readonly spellId: string; readonly x: number; readonly y: number; readonly damage: number }[];
  readonly rng: Rng;
  readonly events: SimEvent[];
  readonly seed: number;
  weapon: WeaponItem;
  readonly inventory: BagItem[];
  readonly gear: Partial<Record<'armour' | 'offhand' | 'helmet' | 'gloves' | 'boots' | 'cloak' | 'amulet' | 'ring1' | 'ring2', string>>;
  readonly gearEnchantment: Record<string, number>;
  readonly cursedGear: Set<string>;
  readonly identifiedItems: Set<string>;
  readonly itemAppearances: Record<string, string>;
  ammo: number;
  readonly groundItems: GroundItem[];
  pendingPickup: GroundItem | null;
  artefactPlaced: boolean;
  nextItem: number;
  itemsEnabled: boolean;
  readonly pickupStats: PickupStats;
  readonly openSkills: Set<string>;
  readonly guaranteedSkills: string[];
  /** Current unique node ID (1..9 remain Dungeon 1..9). */
  depth: number;
  time: number;
  floorTime: number;
  speed: number;
  kills: number;
  nextPack: number;
  nextBand: number;
  descending: number;
  /** A transition disarms the arrival stair until the hero leaves it. */
  stairsArmed: boolean;
  pendingChoices: number;
  choosing: readonly SkillChoice[] | null;
  /** Level-up item cards; legacy skill-choice field remains for existing tools. */
  rewardChoices: readonly ItemChoice[] | null;
  over: boolean;
  won: boolean;
}
export interface Input {
  readonly mx: number;
  readonly my: number;
  readonly throw?: boolean;
  readonly throwAt?: { readonly x: number; readonly y: number };
  readonly hop?: boolean;
  readonly spell?: { readonly id: string; readonly x: number; readonly y: number };
}
