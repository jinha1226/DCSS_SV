import { describe, expect, it } from 'vitest';
import { dance, play, still } from '../bench/bots';

// The stage's own measure of a fight worth having: standing still gets the hero killed, and
// moving well keeps it alive a good deal longer. `npm run bench` prints the fuller picture.
describe('the fight of stage 2', () => {
  const seeds = [1, 2, 3, 4];

  it('kills a hero who stands still, inside a minute and a half', () => {
    for (const seed of seeds) {
      const run = play(still, seed, 120);
      expect(run.fell, `seed ${seed}`).toBe(true);
      expect(run.seconds).toBeLessThan(90);
    }
  });

  it('lets a hero who moves well last at least half as long again, and kill twice as many', () => {
    const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
    const stood = seeds.map((seed) => play(still, seed, 240));
    const moved = seeds.map((seed) => play(dance, seed, 240));
    expect(mean(moved.map((r) => r.seconds))).toBeGreaterThan(mean(stood.map((r) => r.seconds)) * 1.5);
    expect(mean(moved.map((r) => r.kills))).toBeGreaterThan(mean(stood.map((r) => r.kills)) * 2);
  }, 60000);
});
