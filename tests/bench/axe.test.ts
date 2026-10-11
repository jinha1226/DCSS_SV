import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { axeFirst, explore, play, summary } from './bots';

it('measures thirty axe-focused runs', () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const line = 'axe     ' + summary(seeds.map((seed) => play(explore, seed, 420, axeFirst)));
  console.log(line);
  if (process.env.OUT) writeFileSync(process.env.OUT + '.axe', line + '\n');
}, 180000);
