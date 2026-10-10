import type { TileName } from './tiles';

/** What a monster does in a fight. Lengths are in cells, times in seconds. */
export interface MonsterStats {
  readonly hp: number;
  readonly radius: number;
  /** Cells walked in a second. */
  readonly speed: number;
  readonly damage: number;
  /** How close its middle must be to the hero's edge to strike. */
  readonly reach: number;
  /** It draws back this long before a blow lands; stepping out of reach in that time avoids it. */
  readonly windup: number;
  /** The rest between one blow and the next. */
  readonly rest: number;
  /** From how far it notices the hero, when the hero is in plain view. */
  readonly notice: number;
}

export interface MonsterKind {
  readonly id: string;
  readonly name: string;
  readonly tile: TileName;
  /** What it is for in a fight, in one line. */
  readonly role: string;
  /** Missing until the stage that brings the monster in. */
  readonly stats?: MonsterStats;
}

export const MONSTERS: readonly MonsterKind[] = [
  { id: 'rat', name: '쥐', tile: 'mon/rat', role: '약하고 많다' },
  { id: 'bat', name: '박쥐', tile: 'mon/bat', role: '빠르고 갈팡질팡한다' },
  { id: 'jackal', name: '자칼', tile: 'mon/jackal', role: '빠른 무리' },
  {
    id: 'goblin',
    name: '고블린',
    tile: 'mon/goblin',
    role: '기본',
    stats: { hp: 12, radius: 0.3, speed: 4.4, damage: 5, reach: 0.55, windup: 0.4, rest: 0.9, notice: 9 },
  },
  { id: 'kobold', name: '코볼트', tile: 'mon/kobold', role: '멀리서 돌을 던진다' },
  { id: 'adder', name: '독사', tile: 'mon/adder', role: '빠르게 물고 독을 건다' },
  { id: 'gnoll', name: '놀', tile: 'mon/gnoll', role: '한 칸 건너에서 찌르는 무리' },
  { id: 'ogre', name: '오우거', tile: 'mon/ogre', role: '느리고 한 방이 크다' },
];

export function monsterKind(id: string): MonsterKind & { readonly stats: MonsterStats } {
  const kind = MONSTERS.find((m) => m.id === id);
  if (!kind?.stats) throw new Error(`${id}: 아직 싸울 수 없는 몬스터`);
  return kind as MonsterKind & { readonly stats: MonsterStats };
}
