import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../../src/data/monsters';
import { ATLAS_COLS, TILE_SIZE, hasTile, tileRect, tileSet } from '../../src/data/tiles';
import { TILE_NAMES } from '../../src/data/tiles.gen';
import { LOOK } from '../../src/view/look';

const root = join(__dirname, '../..');

function tileFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? tileFiles(join(dir, e.name)) : [join(dir, e.name)]))
    .filter((f) => f.endsWith('.png'));
}

describe('the tile sheet', () => {
  it('lists exactly the tiles under assets/tiles (run `npm run tiles` after changing them)', () => {
    const src = join(root, 'assets/tiles');
    const onDisk = tileFiles(src)
      .map((f) => relative(src, f).replace(/\\/g, '/').replace(/\.png$/, ''))
      .sort();
    expect([...TILE_NAMES]).toEqual(onDisk);
  });

  it('is as large as the list says', () => {
    const png = readFileSync(join(root, 'public/tiles.png'));
    const rows = Math.ceil(TILE_NAMES.length / ATLAS_COLS);
    expect(png.readUInt32BE(16)).toBe(ATLAS_COLS * TILE_SIZE);
    expect(png.readUInt32BE(20)).toBe(rows * TILE_SIZE);
  });

  it('gives every tile its own place', () => {
    const places = new Set(TILE_NAMES.map((n) => `${tileRect(n).x},${tileRect(n).y}`));
    expect(places.size).toBe(TILE_NAMES.length);
  });

  it('finds numbered variants in order', () => {
    expect(tileSet('floor/grey_dirt')).toHaveLength(8);
    expect(tileSet('floor/grey_dirt')[0]).toBe('floor/grey_dirt0');
    expect(tileSet('floor/nothing')).toEqual([]);
  });
});

describe('what is drawn', () => {
  it('has a tile for each of the eight monsters', () => {
    expect(MONSTERS).toHaveLength(8);
    for (const m of MONSTERS) expect(hasTile(m.tile), m.id).toBe(true);
    expect(new Set(MONSTERS.map((m) => m.id)).size).toBe(8);
  });

  it('has floor and wall tiles for every look', () => {
    for (const look of Object.values(LOOK)) {
      expect(look.floor.length).toBeGreaterThan(0);
      expect(look.wall.length).toBeGreaterThan(0);
    }
  });
});
