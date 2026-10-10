import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import { washed, type Atlas, type Sheet } from './atlas';

/** Where a standing figure's tile is cut to make it step. Rows and columns are counted in the tile's own pixels. */
export interface WalkCut {
  /** The first row of the legs; everything above is the body. */
  readonly legs: number;
  /** The first column of the leg on the right; everything left of it is the other leg. */
  readonly mid: number;
}

/** Four frames side by side: standing, one leg up, standing, the other leg up. */
export interface WalkSheet {
  readonly image: Sheet;
  /** The same frames reddened, for when the figure is hurt. */
  readonly hurt: Sheet;
}

export const WALK_FRAMES = 4;
/** Frames shown in a second while walking: four steps a second. */
export const WALK_RATE = 8;

const LIFT = 2;
const BOB = 1;

/**
 * Makes a walk out of a single standing tile, with no new drawing: on a step the body rises a
 * pixel and one leg is pulled up under it. The body is drawn over the legs, so the lifted leg
 * tucks behind the hips and nothing tears.
 */
export function makeWalk(atlas: Atlas, tile: TileName, cut: WalkCut): WalkSheet {
  const S = TILE_SIZE;
  const sheet = document.createElement('canvas');
  sheet.width = S * WALK_FRAMES;
  sheet.height = S;
  const ctx = sheet.getContext('2d');
  const src = tileRect(tile);
  if (!ctx) return { image: atlas.image, hurt: atlas.hurt };

  /** Copies the block (x, y, w, h) of the tile into frame `f`, moved up by `up` pixels. */
  const part = (f: number, x: number, y: number, w: number, h: number, up: number): void => {
    ctx.drawImage(atlas.image, src.x + x, src.y + y, w, h, f * S + x, y - up, w, h);
  };

  for (let f = 0; f < WALK_FRAMES; f++) {
    if (f % 2 === 0) {
      part(f, 0, 0, S, S, 0);
      continue;
    }
    const leftUp = f === 1;
    const legs = S - cut.legs;
    // The planted leg keeps its place; it is drawn from one row higher, so that row still
    // joins it to the risen body.
    if (leftUp) part(f, cut.mid, cut.legs - BOB, S - cut.mid, legs + BOB, 0);
    else part(f, 0, cut.legs - BOB, cut.mid, legs + BOB, 0);
    // The lifted leg.
    if (leftUp) part(f, 0, cut.legs, cut.mid, legs, BOB + LIFT);
    else part(f, cut.mid, cut.legs, S - cut.mid, legs, BOB + LIFT);
    // The body, over both.
    part(f, 0, 0, S, cut.legs, BOB);
  }
  return { image: sheet, hurt: washed(sheet, 'rgba(210, 40, 30, 0.5)') };
}

/** Which frame to show: the standing one when still, else the walk by the clock. */
export function walkFrame(moving: boolean, seconds: number): number {
  return moving ? Math.floor(seconds * WALK_RATE) % WALK_FRAMES : 0;
}

/** Draws frame `frame` with its middle at (cx, cy), turned to face right when `flip` is set. */
export function drawWalker(ctx: CanvasRenderingContext2D, sheet: Sheet, frame: number, cx: number, cy: number, px: number, flip: boolean): void {
  const x = Math.round(cx - px / 2);
  const y = Math.round(cy - px / 2);
  ctx.save();
  if (flip) {
    ctx.translate(x + px, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }
  ctx.drawImage(sheet, frame * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, 0, 0, px, px);
  ctx.restore();
}
