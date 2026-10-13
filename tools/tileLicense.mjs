// Which DCSS tiles may be reused, read from crawl/tiles' TILES_UNDER_UNKNOWN_LICENSE.md.
// Shared by the importer and the tests, so both apply exactly the same rules.
//
// A tile path relative to rltiles (e.g. "mon/animals/rat.png") is excluded when
//   1. the list names that exact path (after dropping "crawl-ref/source/" and "rltiles/"),
//   2. its file name is on the 2010 list, which gives bare file names only, or
//   3. its file name matches an entry under an old "dc-*" folder, which no longer maps to today's layout.

/** @param {string} text the list file's contents */
export function parseUnknownLicense(text) {
  const paths = new Set();
  const bareNames = new Set();
  const oldFolderNames = new Set();
  let nethack = false;
  const nethackPaths = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) nethack = /nethack/i.test(line);
    if (!line.startsWith('- ') || !line.endsWith('.png')) continue;
    const entry = line.slice(2).trim();
    if (!entry.includes('/')) {
      bareNames.add(entry);
      continue;
    }
    const path = entry.replace(/^crawl-ref\/source\//, '').replace(/^rltiles\//, '');
    if (path.split('/')[0].startsWith('dc-')) oldFolderNames.add(baseName(path));
    paths.add(path);
    if (nethack) nethackPaths.add(path);
  }
  return { paths, bareNames, oldFolderNames, nethackPaths };
}

function baseName(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * Why a tile may not be used, or undefined when it may.
 * @param {ReturnType<typeof parseUnknownLicense>} rules
 * @param {string} path relative to rltiles, with ".png"
 */
export function exclusionOf(rules, path) {
  const name = baseName(path);
  if (rules.nethackPaths.has(path)) return 'nethack';
  if (rules.paths.has(path)) return 'path';
  if (rules.bareNames.has(name)) return 'basename2010';
  if (rules.oldFolderNames.has(name)) return 'dcBasename';
  return undefined;
}
