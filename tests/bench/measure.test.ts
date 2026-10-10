import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { dance, flee, kite, play, still, summary, type Bot } from './bots';

// Not part of `npm test`: run with `npm run bench`. Prints how each bot fares.
it('measures the bots', () => {
  const seeds = Array.from({ length: 12 }, (_, i) => i + 1);
  const limit = 240;
  const lines: string[] = [];
  for (const [name, bot] of [['still', still], ['flee', flee], ['kite', kite], ['dance', dance]] as [string, Bot][]) {
    lines.push(`${name.padEnd(6)} ${summary(seeds.map((seed) => play(bot, seed, limit)))}`);
  }
  const text = lines.join('\n');
  console.log(text);
  if (process.env.OUT) writeFileSync(process.env.OUT, text + '\n');
}, 300000);
