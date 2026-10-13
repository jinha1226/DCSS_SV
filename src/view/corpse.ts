import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import type { Sheet } from './atlas';

/** RGBA pixels of a square tile, row by row. */
export interface Pixels {
  readonly data: Uint8ClampedArray;
  readonly size: number;
}

/** How far apart the two halves of a corpse lie, and how wide the cut between them is (DCSS: 3 and 4). */
const CUT_SEPARATE = 3;
const CUT_HEIGHT = 4;
/** Squashing the figure to half its height fakes it lying on the ground. */
const HEIGHT_PROJ = 2;
const WOUND: readonly [number, number, number] = [110, 0, 0];

/** The row the cut runs along at column x: just under the middle, bending up toward the centre. */
function cutHeight(x: number, size: number): number {
  let cy = Math.floor(size / 2) + 2;
  const limit1 = Math.floor(size / 8);
  const limit2 = Math.floor(size / 3);
  if (x < limit1 || x >= size - limit1) cy += 2;
  else if (x < limit2 || x >= size - limit2) cy += 1;
  return cy;
}

function boundingBox(src: Pixels): { cx: number; cy: number } {
  let x0 = src.size;
  let y0 = src.size;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < src.size; y++) {
    for (let x = 0; x < src.size; x++) {
      if (src.data[(y * src.size + x) * 4 + 3] === 0) continue;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return { cx: Math.floor(src.size / 2), cy: Math.floor(src.size / 2) };
  return { cx: Math.floor((x0 + x1) / 2), cy: Math.floor((y0 + y1) / 2) };
}

/**
 * A monster tile made into its corpse the way DCSS's rltiles tool does it (`tile::corpsify`): the
 * figure squashed flat, cut through at the waist with the halves pulled apart, the cut edge
 * coloured as a wound, and a hard diagonal shadow on the floor below.
 */
export function corpsify(src: Pixels): Pixels {
  const size = src.size;
  const out = new Uint8ClampedArray(size * size * 4);
  const filled = new Uint8Array(size * size);
  const { cx, cy: centreY } = boundingBox(src);
  const half = Math.floor(size / 2);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cy = cutHeight(x, size);
      if (y > cy - CUT_HEIGHT && y <= cy) continue;
      let x1 = x - half + cx;
      let y1 = (y - half) * HEIGHT_PROJ + centreY;
      if (y >= cy) {
        x1 -= CUT_SEPARATE;
        y1 -= Math.floor(CUT_HEIGHT / 2);
      } else {
        x1 += CUT_SEPARATE;
        y1 += Math.floor(CUT_HEIGHT / 2) + (CUT_HEIGHT % 2);
      }
      if (x1 < 0 || x1 >= size || y1 < 0 || y1 >= size) continue;
      const from = (y1 * size + x1) * 4;
      const [r, g, b, a] = [src.data[from]!, src.data[from + 1]!, src.data[from + 2]!, src.data[from + 3]!];
      // Rims, shadows and empty pixels stay behind.
      if (a === 0 || (r === 0 && g === 0 && b === 0)) continue;
      out.set([r, g, b, a], (y * size + x) * 4);
      filled[y * size + x] = 1;
    }
  }

  const black = (x: number, y: number): boolean => {
    const i = (y * size + x) * 4;
    return out[i + 3] === 255 && out[i] === 0 && out[i + 1] === 0 && out[i + 2] === 0;
  };
  const paint = (x: number, y: number, rgb: readonly [number, number, number]): void => {
    out.set([...rgb, 255], (y * size + x) * 4);
  };

  // The wound along the top of the lower half.
  for (let x = 0; x < size; x++) {
    const cy = cutHeight(x, size);
    if (!filled[(cy - CUT_HEIGHT) * size + x]) continue;
    const start = cy - CUT_HEIGHT + 1;
    for (let y = start; y < start + Math.min(2, CUT_HEIGHT); y++) paint(x, y, WOUND);
  }

  // A diagonal shadow, then drawn out where the body above it runs on along the diagonal.
  for (let y = 1; y < size; y++) {
    for (let x = 1; x < size; x++) {
      if (!filled[y * size + x] && filled[(y - 1) * size + x - 1] && out[(y * size + x) * 4 + 3] === 0) paint(x, y, [0, 0, 0]);
    }
  }
  for (let y = 3; y < size; y++) {
    for (let x = 3; x < size; x++) {
      if (black(x - 1, y - 1) && filled[(y - 2) * size + x - 2] && filled[(y - 3) * size + x - 3] && black(x - 1, y) && black(x, y - 1)) {
        paint(x, y, [0, 0, 0]);
      }
    }
  }
  return { data: out, size };
}

/** Monsters that leave no blood: the undead and the bloodless, as DCSS's `mons_has_blood`. */
const BLOODLESS: ReadonlySet<string> = new Set(['bog_body']);
/** Monsters that leave no corpse: they crumble away. */
const NO_CORPSE: ReadonlySet<string> = new Set(['bog_body']);

export function bleeds(kind: string): boolean {
  return !BLOODLESS.has(kind);
}

export function leavesCorpse(kind: string): boolean {
  return !NO_CORPSE.has(kind);
}

/** The corpse of one tile of the sheet, drawn into its own canvas. */
export function corpseCanvas(sheet: Sheet, tile: TileName): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const g = c.getContext('2d');
  if (!g) return c;
  const at = tileRect(tile);
  g.drawImage(sheet, at.x, at.y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  const corpse = corpsify({ data: g.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data, size: TILE_SIZE });
  g.putImageData(new ImageData(new Uint8ClampedArray(corpse.data), TILE_SIZE, TILE_SIZE), 0, 0);
  return c;
}
