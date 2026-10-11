import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { bowFirst, hunterExplore, play, summary } from './bots';

it('measures thirty Barachi hunter runs', () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const line = 'barachi ' + summary(seeds.map((seed) => play(hunterExplore, seed, 420, bowFirst, { species: 'barachi', job: 'hunter' })));
  console.log(line);
  if (process.env.OUT) writeFileSync(process.env.OUT + '.barachi', line + '\n');
}, 180000);
