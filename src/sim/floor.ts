import type { Point } from './collide';
import type { Grid } from './grid';

export interface Room {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One level of the dungeon. */
export interface Floor {
  readonly grid: Grid;
  /** Where the hero arrives, in cells (the middle of a cell). */
  readonly start: Point;
  /** The rooms, the one the hero arrives in first. */
  readonly rooms: readonly Room[];
}

export const roomMiddle = (r: Room): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function inRoom(r: Room, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}
