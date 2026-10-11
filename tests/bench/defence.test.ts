import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { defenceFirst, explore, play, summary } from './bots';

it('measures thirty defence-focused runs', () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const line = 'defence ' + summary(seeds.map((seed) => play(explore, seed, 420, defenceFirst)));
  console.log(line);
  if (process.env.OUT) writeFileSync(process.env.OUT + '.defence', line + '\n');
}, 180000);
