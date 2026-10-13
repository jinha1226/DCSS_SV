import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS shared with the packer
import { selectTiles } from '../../tools/tileSelection.mjs';
import { MONSTERS } from '../../src/data/monsters';
import { ATLAS_COLS, SHEET_VERSION, TILE_SIZE, hasTile, tileRect, tileSet } from '../../src/data/tiles';
import { TILE_NAMES } from '../../src/data/tiles.gen';
import { BRANCH_LOOK, LOOK } from '../../src/view/look';

const root = join(__dirname, '../..');

describe('the tile sheet', () => {
  it('lists exactly assets/tiles and the DCSS tiles the game names (run `npm run tiles` after changing them)', () => {
    const expected = (selectTiles(root) as { name: string }[]).map((t) => t.name);
    expect([...TILE_NAMES]).toEqual(expected);
  });

  it('is as large as the list says', () => {
    const png = readFileSync(join(root, 'public/tiles.png'));
    const rows = Math.ceil(TILE_NAMES.length / ATLAS_COLS);
    expect(png.readUInt32BE(16)).toBe(ATLAS_COLS * TILE_SIZE);
    expect(png.readUInt32BE(20)).toBe(rows * TILE_SIZE);
  });

  it('is the very sheet the list was written for (run `npm run tiles` if not)', () => {
    const png = readFileSync(join(root, 'public/tiles.png'));
    expect(createHash('sha1').update(png).digest('hex').slice(0, 10)).toBe(SHEET_VERSION);
  });

  it('gives every tile its own place', () => {
    const places = new Set(TILE_NAMES.map((n) => `${tileRect(n).x},${tileRect(n).y}`));
    expect(places.size).toBe(TILE_NAMES.length);
  });

  it('finds numbered variants in order', () => {
    expect(tileSet('floor/grey_dirt')).toHaveLength(8);
    expect(tileSet('floor/grey_dirt')[0]).toBe('floor/grey_dirt0');
    expect(tileSet('floor/nothing')).toEqual([]);
    expect(tileSet('dcss/dngn/floor/spider')[0]).toBe('dcss/dngn/floor/spider00');
    expect(tileSet('dcss/dngn/floor/sand')).toHaveLength(8);
    expect(tileSet('dcss/dngn/floor/lair')[10]).toBe('dcss/dngn/floor/lair10');
  });
});

describe('what is drawn', () => {
  it('has a tile for each of the monster roster', () => {
    expect(MONSTERS).toHaveLength(21);
    for (const m of MONSTERS) expect(hasTile(m.tile), m.id).toBe(true);
    expect(new Set(MONSTERS.map((m) => m.id)).size).toBe(21);
  });

  it('has floor and wall tiles for every look', () => {
    for (const look of [...Object.values(LOOK), ...Object.values(BRANCH_LOOK)]) {
      expect(look.floor.length).toBeGreaterThan(0);
      expect(look.wall.length).toBeGreaterThan(0);
    }
  });
});
