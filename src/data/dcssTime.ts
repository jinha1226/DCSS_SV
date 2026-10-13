import dungeonRaw from './json/dungeon.json';

/**
 * DCSS turns turned into seconds. DCSS keeps every speed as a ratio to 10: a speed 20
 * monster acts twice per player turn, and an action that costs 15 energy takes 1.5 turns.
 * We keep those ratios and choose how long one turn lasts, separately for walking and
 * for attacking, because in real time walking happens far more often than striking.
 */
export const DCSS_TIME = {
  monsterMove: dungeonRaw.dcssTime.monsterMove,
  monsterAttack: dungeonRaw.dcssTime.monsterAttack,
  heroAttack: dungeonRaw.dcssTime.heroAttack,
  minRest: dungeonRaw.dcssTime.minRest,
} as const;

export interface DcssEnergy {
  readonly move?: number;
  readonly attack?: number;
  readonly missile?: number;
  readonly spell?: number;
  readonly swim?: number;
}

export interface MonsterTiming {
  /** Cells per second on dry ground. */
  readonly speed: number;
  /** Seconds between melee strikes. */
  readonly rest: number;
  readonly restMissile: number;
  readonly restSpell: number;
  /** Multiplier on speed in water, for monsters that live there. */
  readonly swimScale: number;
}

const ENERGY_KEYS = ['move', 'attack', 'missile', 'spell', 'swim'] as const;

export function readEnergy(id: string, raw: unknown): DcssEnergy {
  if (raw === undefined) return {};
  if (typeof raw !== 'object' || raw === null) throw new Error('monsters.json: ' + id + '.dcssEnergy: 객체가 아님');
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!(ENERGY_KEYS as readonly string[]).includes(key)) throw new Error('monsters.json: ' + id + '.dcssEnergy: 모르는 칸 ' + key);
    if (typeof value !== 'number' || !(value > 0)) throw new Error('monsters.json: ' + id + '.dcssEnergy.' + key + ': 양수가 아님');
    out[key] = value;
  }
  return out;
}

export function monsterTiming(id: string, dcssSpeed: number, energy: DcssEnergy, windup: number): MonsterTiming {
  if (!Number.isFinite(dcssSpeed) || dcssSpeed <= 0) throw new Error('monsters.json: ' + id + '.dcssSpeed: 양수가 아님');
  const turns = (cost = 10): number => cost / dcssSpeed;
  const rest = (cost?: number): number => Math.max(DCSS_TIME.minRest, DCSS_TIME.monsterAttack * turns(cost));
  const rangedRest = (cost?: number): number => Math.max(DCSS_TIME.minRest, DCSS_TIME.monsterAttack * turns(cost) - windup);
  const move = energy.move ?? 10;
  return {
    speed: DCSS_TIME.monsterMove / turns(move),
    rest: rest(energy.attack),
    restMissile: rangedRest(energy.missile),
    restSpell: rangedRest(energy.spell),
    swimScale: energy.swim ? move / energy.swim : 1,
  };
}

/** DCSS weapon delay in aut, lowered by half an aut per skill level down to its minimum. */
export function weaponDelay(baseDelay: number, skill: number): number {
  const minDelay = Math.min(Math.floor(baseDelay / 2), 7);
  return Math.max(minDelay, baseDelay - skill / 2);
}

export function heroAttackSeconds(delay: number): number {
  return (DCSS_TIME.heroAttack * delay) / 10;
}
