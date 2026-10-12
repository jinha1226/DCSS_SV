import { describe, expect, it } from 'vitest';
import { stairHoldActive } from '../../src/app/stairInput';
import { makeWorld } from '../../src/sim/world';

describe('paused-time staircase action', () => {
  it('advances time while deliberately staying on a usable stair', () => {
    const w = makeWorld({ seed: 23, monsters: false, items: false });
    const down = w.stairs.find((s) => s.down)!;
    w.hero.x = down.x + 0.5;
    w.hero.y = down.y + 0.5;
    expect(stairHoldActive(w)).toBe(true);
    w.stairsArmed = false;
    expect(stairHoldActive(w)).toBe(false);
  });

  it('does not force time to pass on the entry stair of floor one', () => {
    const w = makeWorld({ seed: 23, monsters: false, items: false });
    expect(stairHoldActive(w)).toBe(false);
  });
});
