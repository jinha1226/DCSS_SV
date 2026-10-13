import { ATLAS_COLS, SHEET_VERSION, TILE_NAMES, TILE_SIZE } from './tiles.gen';

export { ATLAS_COLS, SHEET_VERSION, TILE_SIZE };

/** The name of a tile on the sheet: its path under assets/tiles, e.g. "mon/goblin". */
export type TileName = (typeof TILE_NAMES)[number];

const INDEX = new Map<string, number>(TILE_NAMES.map((n, i) => [n, i]));

/** Where a tile sits on the sheet, in pixels. */
export function tileRect(name: TileName): { x: number; y: number } {
  const i = INDEX.get(name) ?? 0;
  return { x: (i % ATLAS_COLS) * TILE_SIZE, y: Math.floor(i / ATLAS_COLS) * TILE_SIZE };
}

export function hasTile(name: string): name is TileName {
  return INDEX.has(name);
}

/**
 * Every variant of a tile that comes numbered, in number order: "floor/grey_dirt" gives grey_dirt0,
 * grey_dirt1, ...; DCSS sets that start at 1 or use two digits ("spider00") are found the same way.
 */
export function tileSet(prefix: string): TileName[] {
  return TILE_NAMES.filter((n) => n.startsWith(prefix) && /^\d+$/.test(n.slice(prefix.length))).sort(
    (a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)),
  );
}
