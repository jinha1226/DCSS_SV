import { describe, expect, it } from 'vitest';
import { nearestOnScreen } from '../../src/app/aimState';
import { spawnMonster } from '../../src/sim/monster';
import { ndcFromUnit } from '../../src/view3d/world3d';
import { arena } from './arena';

describe('screen-space aim picking', () => {
  it('picks the nearer of two projected candidates', () => {
    const w = arena();
    const left = spawnMonster(w, 'goblin', 12, 10, true);
    const right = spawnMonster(w, 'goblin', 14, 10, true);
    const positions = new Map([
      [left, { u: 0.3, v: 0.5 }],
      [right, { u: 0.7, v: 0.5 }],
    ]);

    expect(nearestOnScreen([left, right], { u: 0.66, v: 0.5 }, (monster) => positions.get(monster), 1, 0.1)).toBe(right);
  });

  it('returns undefined outside the distance limit', () => {
    const w = arena();
    const target = spawnMonster(w, 'goblin', 12, 10, true);

    expect(nearestOnScreen([target], { u: 0.8, v: 0.8 }, () => ({ u: 0.5, v: 0.5 }), 1, 0.07)).toBeUndefined();
  });

  it('hits the segment between a creature foot and body centre', () => {
    const w = arena();
    const target = spawnMonster(w, 'goblin', 12, 10, true);

    expect(nearestOnScreen([target], { u: 0.5, v: 0.42 }, (_monster, height) => ({ u: 0.5, v: 0.6 - height * 0.35 }), 1, 0.03)).toBe(
      target,
    );
  });

  it('weights horizontal distance by the canvas aspect ratio', () => {
    const w = arena();
    const horizontal = spawnMonster(w, 'goblin', 12, 10, true);
    const vertical = spawnMonster(w, 'goblin', 14, 10, true);
    const positions = new Map([
      [horizontal, { u: 0.54, v: 0.5 }],
      [vertical, { u: 0.5, v: 0.56 }],
    ]);
    const project = (monster: typeof horizontal) => positions.get(monster);

    expect(nearestOnScreen([horizontal, vertical], { u: 0.5, v: 0.5 }, project, 1, 0.1)).toBe(horizontal);
    expect(nearestOnScreen([horizontal, vertical], { u: 0.5, v: 0.5 }, project, 2, 0.1)).toBe(vertical);
  });

  it('converts unit canvas coordinates to normalized device coordinates', () => {
    expect(ndcFromUnit(0, 0).toArray()).toEqual([-1, 1]);
    expect(ndcFromUnit(0.5, 0.5).toArray()).toEqual([0, -0]);
    expect(ndcFromUnit(1, 1).toArray()).toEqual([1, -1]);
  });
});
