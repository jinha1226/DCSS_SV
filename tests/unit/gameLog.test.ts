import { describe, expect, it } from 'vitest';
import { eventMessages } from '../../src/ui/gameLog';
import type { SimEvent } from '../../src/sim/world';

describe('DCSS-inspired message log', () => {
  it('groups repeated kills and wakeups in one step', () => {
    const events: SimEvent[] = [
      { type: 'wake', x: 1, y: 1, name: '고블린' },
      { type: 'wake', x: 2, y: 1, name: '고블린' },
      { type: 'kill', x: 1, y: 1, name: '고블린' },
      { type: 'kill', x: 2, y: 1, name: '고블린' },
    ];
    expect(eventMessages(events)).toEqual([
      { text: '고블린이(가) 당신을 알아챘다.', tone: 'warning' },
      { text: '고블린 2마리를 쓰러뜨렸다.', tone: 'normal' },
    ]);
  });

  it('combines physical and elemental damage and ignores routine damage to monsters', () => {
    const events: SimEvent[] = [
      { type: 'hit', x: 1, y: 1, by: 'axe', amount: 8 },
      { type: 'hurt', x: 2, y: 2, amount: 5 },
      { type: 'elemental', x: 2, y: 2, element: 'fire', target: 'hero', amount: 3 },
      { type: 'floor', depth: 2 },
    ];
    expect(eventMessages(events)).toEqual([
      { text: '공격에 맞아 체력 8을(를) 잃었다.', tone: 'warning' },
      { text: '던전 2층에 들어섰다.', tone: 'system' },
    ]);
  });
});
