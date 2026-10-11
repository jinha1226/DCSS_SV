import { roomMiddle, type Floor, type Room } from './floor';
import { FAR, makeFlow, updateFlow } from './flow';
import { Cell, carve, cellAt, makeGrid, setCell, type Grid } from './grid';
import { makeRng, type Rng } from './rng';

/** How a floor is laid out. Lengths are in cells. */
export const GEN = {
  size: 48,
  /** Rooms are tried at random spots until this many stand or the tries run out. */
  rooms: 11,
  tries: 220,
  room: { min: 5, maxW: 11, maxH: 9 },
  /** One floor in two has a hall, with pillars to fight round. */
  hall: { chance: 0.5, minW: 12, maxW: 16, minH: 10, maxH: 13 },
  /** How often a corridor is one, two or three cells wide. */
  widths: [1, 1, 1, 2, 2, 3],
  /** Corridors beyond those needed to join everything up: each closes a ring. */
  rings: 3,
  /** Ways down. */
  stairs: 3,
} as const;

const between = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

function apart(a: Room, b: Room, gap: number): boolean {
  return a.x + a.w + gap <= b.x || b.x + b.w + gap <= a.x || a.y + a.h + gap <= b.y || b.y + b.h + gap <= a.y;
}

function placeRooms(rng: Rng): Room[] {
  const rooms: Room[] = [];
  const fits = (r: Room): boolean => rooms.every((o) => apart(r, o, 2));
  const at = (w: number, h: number): Room => ({ x: between(rng, 2, GEN.size - w - 2), y: between(rng, 2, GEN.size - h - 2), w, h });
  if (rng() < GEN.hall.chance) rooms.push(at(between(rng, GEN.hall.minW, GEN.hall.maxW), between(rng, GEN.hall.minH, GEN.hall.maxH)));
  for (let i = 0; i < GEN.tries && rooms.length < GEN.rooms; i++) {
    const room = at(between(rng, GEN.room.min, GEN.room.maxW), between(rng, GEN.room.min, GEN.room.maxH));
    if (fits(room)) rooms.push(room);
  }
  return rooms;
}

/** Pillars two cells square, set in from the walls of a hall. */
function pillars(g: Grid, hall: Room): void {
  for (const x of [hall.x + 3, hall.x + hall.w - 5]) {
    for (const y of [hall.y + 3, hall.y + hall.h - 5]) {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) setCell(g, x + i, y + j, Cell.Wall);
    }
  }
}

/** A corridor `width` cells wide from one cell to another: along, then across, or the other way round. */
function corridor(g: Grid, rng: Rng, ax: number, ay: number, bx: number, by: number, width: number): void {
  const lowest = GEN.size - 1 - width;
  const span = (from: number, to: number): [number, number] => [Math.min(from, to), Math.abs(to - from) + width];
  const x0 = Math.min(ax, lowest);
  const y0 = Math.min(ay, lowest);
  const x1 = Math.min(bx, lowest);
  const y1 = Math.min(by, lowest);
  const [sx, lx] = span(x0, x1);
  const [sy, ly] = span(y0, y1);
  if (rng() < 0.5) {
    carve(g, sx, y0, lx, width);
    carve(g, x1, sy, width, ly);
  } else {
    carve(g, x0, sy, width, ly);
    carve(g, sx, y1, lx, width);
  }
}

/** Joins every room to the rest by the shortest set of links, then adds a few more to close rings. */
function links(rooms: readonly Room[], rng: Rng): [number, number][] {
  const far = (i: number, j: number): number => {
    const a = roomMiddle(rooms[i]!);
    const b = roomMiddle(rooms[j]!);
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  };
  const out: [number, number][] = [];
  const joined = new Set([0]);
  while (joined.size < rooms.length) {
    let best: [number, number] | undefined;
    for (const i of joined) {
      for (let j = 0; j < rooms.length; j++) {
        if (!joined.has(j) && (!best || far(i, j) < far(best[0], best[1]))) best = [i, j];
      }
    }
    if (!best) break;
    out.push(best);
    joined.add(best[1]);
  }
  // Rings: each room's nearest neighbour it is not yet linked to, a few of them picked at random.
  const spare: [number, number][] = [];
  for (let i = 0; i < rooms.length; i++) {
    let best = -1;
    for (let j = 0; j < rooms.length; j++) {
      if (i === j || out.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
      if (best < 0 || far(i, j) < far(i, best)) best = j;
    }
    if (best >= 0 && !spare.some(([a, b]) => a === best && b === i)) spare.push([i, best]);
  }
  for (let n = 0; n < GEN.rings && spare.length; n++) out.push(spare.splice(Math.floor(rng() * spare.length), 1)[0]!);
  return out;
}

/** An open cell of a room that is not against a wall, so stairs never sit in a doorway. */
function spot(g: Grid, rng: Rng, room: Room): { x: number; y: number } {
  for (let i = 0; i < 40; i++) {
    const x = between(rng, room.x + 1, room.x + room.w - 2);
    const y = between(rng, room.y + 1, room.y + room.h - 2);
    if (cellAt(g, x, y) === Cell.Floor) return { x, y };
  }
  return { x: room.x + 1, y: room.y + 1 };
}

/**
 * Lays out a floor from a seed: rooms, corridors one to three cells wide, a few rings, sometimes
 * a pillared hall, a way up where the hero arrives and three ways down in the rooms farthest from it.
 */
export function makeFloor(seed: number): Floor {
  const rng = makeRng(seed);
  const grid = makeGrid(GEN.size, GEN.size);
  const placed = placeRooms(rng);
  for (const r of placed) carve(grid, r.x, r.y, r.w, r.h);
  const hall = placed[0];
  if (hall && hall.w >= GEN.hall.minW && hall.h >= GEN.hall.minH) pillars(grid, hall);
  for (const [i, j] of links(placed, rng)) {
    const a = roomMiddle(placed[i]!);
    const b = roomMiddle(placed[j]!);
    const width = GEN.widths[Math.floor(rng() * GEN.widths.length)]!;
    corridor(grid, rng, Math.floor(a.x), Math.floor(a.y), Math.floor(b.x), Math.floor(b.y), width);
  }

  // The hero arrives in a room picked at random; the ways down go in the rooms farthest by foot.
  const first = Math.floor(rng() * placed.length);
  const up = spot(grid, rng, placed[first]!);
  setCell(grid, up.x, up.y, Cell.StairsUp);
  const flow = makeFlow(grid);
  updateFlow(flow, grid, up.x, up.y);
  const walk = (r: Room): number => {
    const m = roomMiddle(r);
    const d = flow.dist[Math.floor(m.y) * grid.w + Math.floor(m.x)]!;
    return d === FAR ? -1 : d;
  };
  const others = placed.filter((_, i) => i !== first).sort((a, b) => walk(b) - walk(a));
  for (const room of others.slice(0, GEN.stairs)) {
    const down = spot(grid, rng, room);
    setCell(grid, down.x, down.y, Cell.StairsDown);
  }

  const rooms = [placed[first]!, ...placed.filter((_, i) => i !== first)];
  return { grid, start: { x: up.x + 0.5, y: up.y + 0.5 }, rooms };
}
