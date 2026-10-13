import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS shared with the importer
import { exclusionOf, parseUnknownLicense } from '../../tools/tileLicense.mjs';
import { TILE_NAMES } from '../../src/data/tiles.gen';

const root = join(__dirname, '../..');
const rules = parseUnknownLicense(readFileSync(join(root, 'assets/dcss/unknown-license.txt'), 'utf8'));
const index = JSON.parse(readFileSync(join(root, 'assets/dcss/index.json'), 'utf8')) as {
  tiles: { name: string; derivedFrom?: string }[];
};
const pathOf = (name: string): string => name.slice('dcss/'.length) + '.png';

describe('DCSS tiles we may reuse', () => {
  it('reads all three parts of the unknown-licence list', () => {
    expect(exclusionOf(rules, 'item/weapon/ranged/javelin1.png')).toBe('basename2010');
    expect(exclusionOf(rules, 'mon/animals/rat.png')).toBe('path');
    expect(exclusionOf(rules, 'player/felids/cat1.png')).toBe('nethack');
    expect(exclusionOf(rules, 'mon/animals/wolf.png')).toBeUndefined();
  });

  it('keeps every excluded tile out of the library', () => {
    const offending = index.tiles.filter((t) => exclusionOf(rules, pathOf(t.derivedFrom ?? t.name)));
    expect(offending.map((t) => t.name)).toEqual([]);
  });

  it('puts only reusable library tiles on the sheet', () => {
    const library = new Set(index.tiles.map((t) => t.name));
    for (const name of TILE_NAMES.filter((n) => n.startsWith('dcss/'))) expect(library.has(name), name).toBe(true);
  });
});
