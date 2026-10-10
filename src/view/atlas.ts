import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';

/** The tile sheet, once loaded. */
export interface Atlas {
  readonly image: HTMLImageElement;
}

export function loadAtlas(): Promise<Atlas> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image });
    image.onerror = () => reject(new Error('타일 그림을 불러오지 못했다'));
    image.src = `${import.meta.env.BASE_URL}tiles.png`;
  });
}

/** Draws one tile with its top-left corner at (x, y), `size` pixels wide. */
export function drawTile(
  ctx: CanvasRenderingContext2D,
  atlas: Atlas,
  name: TileName,
  x: number,
  y: number,
  size: number,
): void {
  const at = tileRect(name);
  ctx.drawImage(atlas.image, at.x, at.y, TILE_SIZE, TILE_SIZE, x, y, size, size);
}
