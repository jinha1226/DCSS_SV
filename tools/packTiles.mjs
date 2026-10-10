// Packs every tile under assets/tiles into one sheet.
//   public/tiles.png        the sheet
//   src/data/tiles.gen.ts   where each tile sits in it
// A tile's name is its path under assets/tiles without ".png", e.g. "mon/goblin".
// Run with `npm run tiles` after adding or removing a tile.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import UPNG from 'upng-js';

const root = new URL('..', import.meta.url).pathname;
const src = join(root, 'assets/tiles');
const SIZE = 32;
const COLS = 16;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    .filter((f) => f.endsWith('.png'));
}

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

const files = walk(src).sort();
const rows = Math.ceil(files.length / COLS);
const width = COLS * SIZE;
const sheet = new Uint8Array(width * rows * SIZE * 4);
const names = [];

files.forEach((file, i) => {
  const name = relative(src, file).replace(/\\/g, '/').replace(/\.png$/, '');
  const tile = readTile(file, name);
  const left = (i % COLS) * SIZE;
  const top = Math.floor(i / COLS) * SIZE;
  for (let y = 0; y < SIZE; y++) {
    sheet.set(tile.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), ((top + y) * width + left) * 4);
  }
  names.push(name);
});

writeFileSync(join(root, 'public/tiles.png'), new Uint8Array(UPNG.encode([sheet.buffer], width, rows * SIZE, 0)));
writeFileSync(
  join(root, 'src/data/tiles.gen.ts'),
  [
    '// Written by tools/packTiles.mjs. Do not edit by hand.',
    `export const TILE_SIZE = ${SIZE};`,
    `export const ATLAS_COLS = ${COLS};`,
    'export const TILE_NAMES = [',
    ...names.map((n) => `  '${n}',`),
    '] as const;',
    '',
  ].join('\n'),
);
console.log(`${names.length} tiles -> public/tiles.png (${width}x${rows * SIZE})`);
