import { ATLAS_COLS, TILE_NAMES, TILE_SIZE } from './tiles.gen';

export { ATLAS_COLS, TILE_SIZE };

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

/** Every variant of a tile that comes numbered: "floor/grey_dirt" gives grey_dirt0, grey_dirt1, ... */
export function tileSet(prefix: string): TileName[] {
  const out: TileName[] = [];
  for (let i = 0; hasTile(`${prefix}${i}`); i++) out.push(`${prefix}${i}` as TileName);
  return out;
}
