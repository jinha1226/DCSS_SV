import { describe, expect, it } from 'vitest';

function shouldStep(superhot: boolean, mx: number, my: number, action = false): boolean {
  return !superhot || Math.hypot(mx, my) > 0.01 || action;
}

describe('SUPERHOT mode stepping', () => {
  it('always runs in realtime mode', () => {
    expect(shouldStep(false, 0, 0)).toBe(true);
  });

  it('stops while idle in SUPERHOT mode', () => {
    expect(shouldStep(true, 0, 0)).toBe(false);
  });

  it('runs while moving or using an action', () => {
    expect(shouldStep(true, 1, 0)).toBe(true);
    expect(shouldStep(true, 0, 0, true)).toBe(true);
  });
});
