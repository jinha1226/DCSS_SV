import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { explore, play, summary } from './bots';

it('measures thirty Fighter runs for Gargoyle, Troll, and Mountain Dwarf', () => {
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);
  const lines = (['gargoyle', 'troll', 'mountain_dwarf'] as const).map(
    (species) => species + ' fighter ' + summary(seeds.map((seed) => play(explore, seed, 420, undefined, { species, job: 'fighter' }))),
  );
  const report = lines.join('\n');
  console.log(report);
  if (process.env.OUT) writeFileSync(process.env.OUT + '.fighter-species', report + '\n');
}, 540000);
