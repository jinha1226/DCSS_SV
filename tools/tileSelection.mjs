// Which tiles go on the sheet: everything under assets/tiles, and the DCSS library tiles the game names.
// Shared by packTiles.mjs and the tests.
//
// A library tile is on the sheet when
//   - its name ("dcss/...") appears quoted in src/**/*.ts or src/**/*.json, or
//   - assets/dcss-include.json lists it. An entry ending in "#" takes every numbered variant:
//     "dcss/dngn/floor/lair#" means lair0, lair1, ... (and lair00, lair01 for two-digit sets).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export const SIZE = 32;

function walk(dir, ext) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), ext) : e.name.endsWith(ext) ? [join(dir, e.name)] : [],
  );
}

/** @returns {{ name: string, file: string }[]} every tile for the sheet, sorted by name */
export function selectTiles(root) {
  const own = join(root, 'assets/tiles');
  const library = join(root, 'assets/dcss');
  const picked = new Map();
  for (const file of walk(own, '.png')) {
    const name = relative(own, file)
      .replace(/\\/g, '/')
      .replace(/\.png$/, '');
    picked.set(name, file);
  }

  const index = JSON.parse(readFileSync(join(library, 'index.json'), 'utf8')).tiles;
  const sizes = new Map(index.map((t) => [t.name, t]));
  const wanted = new Map();
  const want = (name, where) => {
    if (!sizes.has(name)) throw new Error(`${where}: no DCSS tile called ${name}`);
    const tile = sizes.get(name);
    if (tile.w !== SIZE || tile.h !== SIZE) throw new Error(`${where}: ${name} is ${tile.w}x${tile.h}, the sheet takes ${SIZE}x${SIZE}`);
    wanted.set(name, where);
  };

  const src = join(root, 'src');
  for (const file of [...walk(src, '.ts'), ...walk(src, '.json')]) {
    if (file.endsWith('tiles.gen.ts')) continue;
    const text = readFileSync(file, 'utf8');
    // A name followed by "${", or ending in "/", is only the start of a name built at run time; the
    // include list covers those.
    for (const m of text.matchAll(/['"`](dcss\/[A-Za-z0-9_+\-/]+)(['"`]|\$\{)/g)) {
      if (m[2] === '${' || m[1].endsWith('/')) continue;
      want(m[1], relative(root, file));
    }
  }

  const includes = JSON.parse(readFileSync(join(root, 'assets/dcss-include.json'), 'utf8'));
  for (const entry of includes) {
    if (!entry.endsWith('#')) {
      want(entry, 'assets/dcss-include.json');
      continue;
    }
    const prefix = entry.slice(0, -1);
    const variants = index.filter((t) => t.name.startsWith(prefix) && /^\d+$/.test(t.name.slice(prefix.length)));
    if (variants.length === 0) throw new Error(`assets/dcss-include.json: no numbered tiles start ${prefix}`);
    for (const t of variants) want(t.name, 'assets/dcss-include.json');
  }

  for (const name of wanted.keys()) picked.set(name, join(library, name.slice('dcss/'.length) + '.png'));
  return [...picked.entries()].map(([name, file]) => ({ name, file })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
