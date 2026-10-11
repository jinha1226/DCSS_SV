import { SHEET_VERSION, TILE_SIZE, tileRect, type TileName } from '../data/tiles';

export type Sheet = HTMLImageElement | HTMLCanvasElement;

/** The tile sheet, once loaded, and two washed copies of it for showing a blow. */
export interface Atlas {
  readonly image: Sheet;
  /** Every tile lightened: a figure that was just struck is drawn from this for a moment. */
  readonly struck: Sheet;
  /** Every tile reddened: the hero when hurt. */
  readonly hurt: Sheet;
}

/** A copy of the sheet with a colour laid over the drawn pixels only. */
export function washed(image: Sheet, colour: string): Sheet {
  const copy = document.createElement('canvas');
  copy.width = image.width;
  copy.height = image.height;
  const ctx = copy.getContext('2d');
  if (!ctx) return image;
  ctx.drawImage(image, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, copy.width, copy.height);
  return copy;
}

export function loadAtlas(): Promise<Atlas> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ image, struck: washed(image, 'rgba(255, 246, 220, 0.55)'), hurt: washed(image, 'rgba(210, 40, 30, 0.5)') });
    image.onerror = () => reject(new Error('타일 그림을 불러오지 못했다'));
    // Asked for by its stamp: a sheet with tiles added must not be served from an old copy.
    image.src = `${import.meta.env.BASE_URL}tiles.png?v=${SHEET_VERSION}`;
  });
}

/** Draws one tile with its top-left corner at (x, y), `size` pixels wide. */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  sheet: Sheet,
  name: TileName,
  x: number,
  y: number,
  size: number,
): void {
  const at = tileRect(name);
  ctx.drawImage(sheet, at.x, at.y, TILE_SIZE, TILE_SIZE, x, y, size, size);
}
