import { walkable } from './grid';
import { spawnMonster } from './monster';
import type { Room } from './testFloor';
import type { World } from './types';

/** Stage 2 has no generated floors yet: bands stand in the rooms, and more keep arriving. */
export const WAVES = {
  /** How many goblins stand in each room at the start; the hero's own room is empty. */
  rooms: [0, 6, 20, 8, 8],
  /** Seconds before the first band arrives, and between bands. */
  first: 14,
  every: 10,
  /** A band's size at the start, and how much it grows each half minute. */
  size: 5,
  growth: 1,
  /** No band arrives while this many monsters are on the floor. */
  most: 140,
} as const;

/** Puts `count` monsters on open cells of a room, no two on the same cell. */
export function fillRoom(w: World, room: Room, count: number, awake: boolean): void {
  const free: number[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) if (walkable(w.grid, x, y)) free.push(y * w.grid.w + x);
  }
  for (let i = 0; i < count && free.length; i++) {
    const at = Math.floor(w.rng() * free.length);
    const cell = free[at]!;
    free[at] = free[free.length - 1]!;
    free.pop();
    const x = cell % w.grid.w;
    spawnMonster(w, 'goblin', x + 0.5, (cell - x) / w.grid.w + 0.5, awake);
  }
}

export function placeBands(w: World): void {
  w.rooms.forEach((room, i) => fillRoom(w, room, WAVES.rooms[i] ?? 0, false));
  w.nextWave = WAVES.first;
}

/** A band arrives, awake, in a room the hero cannot see into; failing that, the farthest room. */
export function arrive(w: World, dt: number): void {
  w.nextWave -= dt;
  if (w.nextWave > 0) return;
  w.nextWave = WAVES.every;
  if (w.monsters.length >= WAVES.most) return;

  const far = (r: Room): number => Math.hypot(r.x + r.w / 2 - w.hero.x, r.y + r.h / 2 - w.hero.y);
  const hidden = w.rooms.filter((r) => {
    const cx = Math.floor(r.x + r.w / 2);
    const cy = Math.floor(r.y + r.h / 2);
    return !w.visible[cy * w.grid.w + cx] && far(r) > 10;
  });
  const room = hidden.length
    ? hidden[Math.floor(w.rng() * hidden.length)]
    : [...w.rooms].sort((a, b) => far(b) - far(a))[0];
  if (room) fillRoom(w, room, WAVES.size + WAVES.growth * Math.floor(w.time / 30), true);
}
