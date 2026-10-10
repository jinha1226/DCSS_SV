import type { TileName } from './tiles';

/** A kind of monster. Numbers for fighting come with stage 2 and 3. */
export interface MonsterKind {
  readonly id: string;
  readonly name: string;
  readonly tile: TileName;
  /** What it is for in a fight, in one line. */
  readonly role: string;
}

export const MONSTERS: readonly MonsterKind[] = [
  { id: 'rat', name: '쥐', tile: 'mon/rat', role: '약하고 많다' },
  { id: 'bat', name: '박쥐', tile: 'mon/bat', role: '빠르고 갈팡질팡한다' },
  { id: 'jackal', name: '자칼', tile: 'mon/jackal', role: '빠른 무리' },
  { id: 'goblin', name: '고블린', tile: 'mon/goblin', role: '기본' },
  { id: 'kobold', name: '코볼트', tile: 'mon/kobold', role: '멀리서 돌을 던진다' },
  { id: 'adder', name: '독사', tile: 'mon/adder', role: '빠르게 물고 독을 건다' },
  { id: 'gnoll', name: '놀', tile: 'mon/gnoll', role: '한 칸 건너에서 찌르는 무리' },
  { id: 'ogre', name: '오우거', tile: 'mon/ogre', role: '느리고 한 방이 크다' },
];
