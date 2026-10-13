import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
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

describe('our own picked tiles (assets/tiles)', () => {
  const sources = JSON.parse(readFileSync(join(root, 'assets/tiles/SOURCES.json'), 'utf8')) as Record<
    string,
    { from: 'crawl' | 'ancient-2010'; path: string; sha1: string }
  >;
  const own = join(root, 'assets/tiles');
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.png') ? [join(dir, e.name)] : [],
    );

  it('says where every one came from, byte for byte', () => {
    const names = files(own).map((f) =>
      relative(own, f)
        .replace(/\\/g, '/')
        .replace(/\.png$/, ''),
    );
    expect(names.sort()).toEqual(Object.keys(sources).sort());
    for (const name of names) {
      const sha1 = createHash('sha1')
        .update(readFileSync(join(own, name + '.png')))
        .digest('hex');
      expect(sha1, name).toBe(sources[name]!.sha1);
    }
  });

  it('takes nothing from DCSS that the list leaves out (older pictures come from the 2010 CC0 release)', () => {
    for (const [name, source] of Object.entries(sources)) {
      if (source.from === 'crawl') expect(exclusionOf(rules, source.path), name).toBeUndefined();
      else expect(source.from, name).toBe('ancient-2010');
    }
  });
});
