import type { TileName } from './tiles';

/** What a monster does in a fight. Lengths are in cells, times in seconds. */
export interface MonsterStats {
  readonly hp: number;
  /** Half its width. Close to half a cell, so no two monsters stand on one cell. */
  readonly radius: number;
  /** Cells walked in a second. The hero walks 6.5. */
  readonly speed: number;
  readonly damage: number;
  /** How far past the hero's edge its blow carries, measured to its own middle. */
  readonly reach: number;
  /** It draws back this long before a blow lands; stepping out of reach in that time avoids it. */
  readonly windup: number;
  /** The rest between one blow and the next. */
  readonly rest: number;
  /** From how far it notices the hero while asleep, when the hero is in plain view. */
  readonly notice: number;
  /** It does not close in: it keeps this far off and throws. */
  readonly throws?: { readonly range: number; readonly keep: number; readonly speed: number };
  /** After a blow it darts off for a moment before coming back. */
  readonly flits?: number;
  /** Its bite poisons for this many seconds. */
  readonly poison?: number;
}

export interface MonsterKind {
  readonly id: string;
  readonly name: string;
  readonly tile: TileName;
  /** What it is for in a fight, in one line. */
  readonly role: string;
  readonly stats: MonsterStats;
}

export const MONSTERS: readonly MonsterKind[] = [
  {
    id: 'rat',
    name: '쥐',
    tile: 'mon/rat',
    role: '약하고 많다',
    stats: { hp: 5, radius: 0.4, speed: 4.8, damage: 2, reach: 0.55, windup: 0.3, rest: 0.7, notice: 6 },
  },
  {
    id: 'bat',
    name: '박쥐',
    tile: 'mon/bat',
    role: '빠르고 갈팡질팡한다',
    stats: { hp: 6, radius: 0.38, speed: 7.6, damage: 2, reach: 0.55, windup: 0.18, rest: 0.5, notice: 5, flits: 0.8 },
  },
  {
    id: 'jackal',
    name: '자칼',
    tile: 'mon/jackal',
    role: '빠른 무리',
    stats: { hp: 8, radius: 0.42, speed: 6.0, damage: 3, reach: 0.55, windup: 0.3, rest: 0.8, notice: 8 },
  },
  {
    id: 'goblin',
    name: '고블린',
    tile: 'mon/goblin',
    role: '기본',
    stats: { hp: 12, radius: 0.45, speed: 4.4, damage: 5, reach: 0.6, windup: 0.4, rest: 0.9, notice: 6 },
  },
  {
    id: 'kobold',
    name: '코볼트',
    tile: 'mon/kobold',
    role: '멀리서 돌을 던진다',
    stats: {
      hp: 9,
      radius: 0.42,
      speed: 4.2,
      damage: 4,
      reach: 0.55,
      windup: 0.45,
      rest: 1.7,
      notice: 7,
      throws: { range: 7, keep: 3.5, speed: 9 },
    },
  },
  {
    id: 'adder',
    name: '독사',
    tile: 'mon/adder',
    role: '빠르게 물고 독을 건다',
    stats: { hp: 8, radius: 0.4, speed: 5.6, damage: 3, reach: 0.55, windup: 0.25, rest: 1.0, notice: 4, poison: 4 },
  },
  {
    id: 'gnoll',
    name: '놀',
    tile: 'mon/gnoll',
    role: '한 칸 건너에서 찌르는 무리',
    stats: { hp: 16, radius: 0.46, speed: 4.4, damage: 6, reach: 1.5, windup: 0.5, rest: 1.1, notice: 7 },
  },
  {
    id: 'ogre',
    name: '오우거',
    tile: 'mon/ogre',
    role: '느리고 한 방이 크다',
    stats: { hp: 60, radius: 0.48, speed: 3.2, damage: 18, reach: 0.75, windup: 0.85, rest: 1.4, notice: 5 },
  },
];

/** Health a poisoned hero loses in a second. */
export const POISON = 2;

export function monsterKind(id: string): MonsterKind {
  const kind = MONSTERS.find((m) => m.id === id);
  if (!kind) throw new Error(`${id}: 없는 몬스터`);
  return kind;
}
