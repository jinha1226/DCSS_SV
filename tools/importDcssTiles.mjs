// Copies every reusable DCSS tile into assets/dcss, keeping DCSS's own folders and file names.
//   node tools/importDcssTiles.mjs <rltiles dir> <crawl/tiles checkout> <crawl commit> <tiles commit>
// Writes
//   assets/dcss/<path>.png          each tile, byte for byte
//   assets/dcss/derived/...         recoloured tiles DCSS builds at compile time (e.g. the yellow Zot wall)
//   assets/dcss/index.json          every tile's name and size
//   assets/dcss/excluded.json       what was left out and by which rule
//   assets/dcss/unknown-license.txt the list the rules come from, for the tests
// A tile's name is "dcss/" + its path without ".png", e.g. "dcss/mon/animals/wolf".
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import UPNG from 'upng-js';
import { exclusionOf, parseUnknownLicense } from './tileLicense.mjs';

const [rltiles, tilesRepo, crawlCommit, tilesCommit] = process.argv.slice(2);
if (!rltiles || !tilesRepo || !crawlCommit || !tilesCommit) {
  console.error('usage: node tools/importDcssTiles.mjs <rltiles dir> <crawl/tiles checkout> <crawl commit> <tiles commit>');
  process.exit(1);
}

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'assets/dcss');
const listText = readFileSync(join(tilesRepo, 'TILES_UNDER_UNKNOWN_LICENSE.md'), 'utf8');
const rules = parseUnknownLicense(listText);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    .filter((f) => f.endsWith('.png'));
}

function decode(buf) {
  return UPNG.decode(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

/** DCSS's `%hue from to`: pixels whose hue is exactly `from` take hue `to`, keeping their lightness range. */
function shiftHue(png, from, to) {
  const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
  for (let i = 0; i < rgba.length; i += 4) {
    const [r, g, b] = [rgba[i], rgba[i + 1], rgba[i + 2]];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) continue;
    const diff = max - min;
    const hue =
      max === r
        ? (Math.trunc((60 * (g - b)) / diff) + 360) % 360
        : max === g
          ? Math.trunc((60 * (b - r)) / diff) + 120
          : Math.trunc((60 * (r - g)) / diff) + 240;
    if (hue !== from) continue;
    const f = to / 60 - Math.trunc(to / 60);
    const p = max - diff;
    const q = Math.max(0, Math.min(255, Math.trunc(max - f * diff)));
    const t = Math.max(0, Math.min(255, Math.trunc(max - (1 - f) * diff)));
    const rgb = [
      [max, t, p],
      [q, max, p],
      [p, max, t],
      [p, q, max],
      [t, p, max],
      [max, p, q],
    ][Math.trunc(to / 60) % 6];
    rgba.set(rgb, i);
  }
  return new Uint8Array(UPNG.encode([rgba.buffer], png.width, png.height, 0));
}

/** Recoloured walls DCSS makes while building, not shipped as files. */
const DERIVED = [0, 1, 2, 3].map((i) => ({ path: `derived/wall/zot_yellow${i}.png`, from: `dngn/wall/zot_blue${i}.png`, hue: [240, 50] }));

rmSync(out, { recursive: true, force: true });
const tiles = [];
const excluded = [];
for (const file of walk(rltiles).sort()) {
  const path = relative(rltiles, file).replace(/\\/g, '/');
  const rule = exclusionOf(rules, path);
  if (rule) {
    excluded.push({ path, rule });
    continue;
  }
  const target = join(out, path);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(file, target);
  const png = decode(readFileSync(file));
  tiles.push({ name: 'dcss/' + path.replace(/\.png$/, ''), w: png.width, h: png.height });
}
for (const d of DERIVED) {
  if (exclusionOf(rules, d.from)) throw new Error(`${d.from} is excluded, so ${d.path} cannot be made from it`);
  const png = decode(readFileSync(join(rltiles, d.from)));
  const target = join(out, d.path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, shiftHue(png, d.hue[0], d.hue[1]));
  tiles.push({
    name: 'dcss/' + d.path.replace(/\.png$/, ''),
    w: png.width,
    h: png.height,
    derivedFrom: 'dcss/' + d.from.replace(/\.png$/, ''),
  });
}
tiles.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

writeFileSync(
  join(out, 'index.json'),
  JSON.stringify({ source: { crawl: crawlCommit, tiles: tilesCommit }, tiles }, null, 0).replace(/},{/g, '},\n{') + '\n',
);
writeFileSync(join(out, 'excluded.json'), JSON.stringify(excluded, null, 0).replace(/},{/g, '},\n{') + '\n');
writeFileSync(join(out, 'unknown-license.txt'), listText);
console.log(`${tiles.length} tiles imported, ${excluded.length} left out -> assets/dcss`);
