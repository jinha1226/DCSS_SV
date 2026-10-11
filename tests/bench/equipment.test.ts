import { it } from 'vitest';
import { axeFirst, explore, play } from './bots';

it('measures thirty equipment runs', () => {
  const runs = Array.from({ length: 30 }, (_, i) => play(explore, i + 1, 420, axeFirst));
  const mean = (key: 'offered' | 'swapped' | 'throws' | 'recovered'): number => runs.reduce((sum, r) => sum + r[key], 0) / runs.length;
  const throws = mean('throws'),
    recovered = mean('recovered');
  console.log(
    'equipment 30 runs: offers ' +
      mean('offered').toFixed(1) +
      ', swaps ' +
      mean('swapped').toFixed(1) +
      ', throws ' +
      throws.toFixed(1) +
      ', recovered ' +
      recovered.toFixed(1) +
      ' (' +
      (throws ? (recovered / throws) * 100 : 0).toFixed(0) +
      '%)',
  );
}, 180000);
