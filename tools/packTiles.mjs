// Packs the game's tiles into one sheet: all of assets/tiles, and the DCSS library tiles the game names
// (see tileSelection.mjs).
//   public/tiles.png        the sheet
//   src/data/tiles.gen.ts   where each tile sits in it
// A tile's name is its path under assets/tiles without ".png", e.g. "mon/goblin", or "dcss/" + its DCSS path.
// Run with `npm run tiles` after adding or removing a tile, or naming a new DCSS tile in the code.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import UPNG from 'upng-js';
import { selectTiles, SIZE } from './tileSelection.mjs';

const root = new URL('..', import.meta.url).pathname;
const COLS = 16;

/** A tile file as plain RGBA bytes, whatever kind of PNG it was saved as. */
function readTile(file, name) {
  const buf = readFileSync(file);
  const png = UPNG.decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  if (png.width !== SIZE || png.height !== SIZE) {
    console.error(`${name}: ${png.width}x${png.height}, every tile must be ${SIZE}x${SIZE}`);
    process.exit(1);
  }
  return new Uint8Array(UPNG.toRGBA8(png)[0]);
}

const files = selectTiles(root);
const rows = Math.ceil(files.length / COLS);
const width = COLS * SIZE;
const sheet = new Uint8Array(width * rows * SIZE * 4);
const names = [];

files.forEach(({ name, file }, i) => {
  const tile = readTile(file, name);
  const left = (i % COLS) * SIZE;
  const top = Math.floor(i / COLS) * SIZE;
  for (let y = 0; y < SIZE; y++) {
    sheet.set(tile.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), ((top + y) * width + left) * 4);
  }
  names.push(name);
});

const png = new Uint8Array(UPNG.encode([sheet.buffer], width, rows * SIZE, 0));
// The sheet keeps one address, so a browser would go on using an old copy after tiles are added
// and draw every later tile one place off. The page asks for it by this stamp instead.
const version = createHash('sha1').update(png).digest('hex').slice(0, 10);
writeFileSync(join(root, 'public/tiles.png'), png);
writeFileSync(
  join(root, 'src/data/tiles.gen.ts'),
  [
    '// Written by tools/packTiles.mjs. Do not edit by hand.',
    `export const TILE_SIZE = ${SIZE};`,
    `export const ATLAS_COLS = ${COLS};`,
    `export const SHEET_VERSION = '${version}';`,
    'export const TILE_NAMES = [',
    ...names.map((n) => `  '${n}',`),
    '] as const;',
    '',
  ].join('\n'),
);
console.log(`${names.length} tiles -> public/tiles.png (${width}x${rows * SIZE})`);
