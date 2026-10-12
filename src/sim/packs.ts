import { DUNGEON, PACKS, type PackKind } from '../data/packs';
import { inRoom } from './floor';
import { FAR } from './flow';
import { Cell, cellAt, walkable } from './grid';
import { spawnMonster } from './monster';
import type { World } from './types';

/** A band found on this floor, picked by weight. */
export function pickPack(w: World): PackKind {
  const difficulty = w.dungeonGraph.nodes.get(w.depth)?.difficulty ?? w.depth;
  const node = w.dungeonGraph.nodes.get(w.depth);
  const branch = node?.branch ?? 'Dungeon';
  const floor = node?.floor ?? w.depth;
  const scoped = PACKS.filter((p) => p.branch === branch);
  const found = scoped.filter((p) => floor >= p.floors[0] && floor <= p.floors[1]);
  const common = PACKS.filter((p) => !p.branch);
  const normal = common.filter((p) => difficulty >= p.floors[0] && difficulty <= p.floors[1]);
  const candidates = found.length ? found : normal.length ? normal : common.filter((p) => p.floors[1] === 3);
  let roll = w.rng() * candidates.reduce((sum, p) => sum + p.weight, 0);
  for (const p of candidates) {
    roll -= p.weight;
    if (roll <= 0) return p;
  }
  return candidates[candidates.length - 1] ?? PACKS[0]!;
}

/**
 * Puts a band on the open cells nearest (cx, cy) that pass `allowed`, one monster to a cell.
 * Returns how many were placed.
 */
export function placePack(
  w: World,
  kind: PackKind,
  cx: number,
  cy: number,
  awake: boolean,
  allowed: (x: number, y: number) => boolean,
  rewardless = false,
): number {
  const cells: { x: number; y: number; d: number }[] = [];
  for (let y = cy - 4; y <= cy + 4; y++) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      if (cellAt(w.grid, x, y) !== Cell.Floor || !allowed(x, y)) continue;
      if (w.monsters.some((m) => Math.floor(m.x) === x && Math.floor(m.y) === y)) continue;
      cells.push({ x, y, d: Math.hypot(x - cx, y - cy) + w.rng() * 0.8 });
    }
  }
  cells.sort((a, b) => a.d - b.d);
  const pack = w.nextPack++;
  let placed = 0;
  kind.members.forEach((member, i) => {
    let count = member.min + Math.floor(w.rng() * (member.max - member.min + 1));
    if (i === 0) {
      const floor = kind.branch
        ? (w.dungeonGraph.nodes.get(w.depth)?.floor ?? 1)
        : (w.dungeonGraph.nodes.get(w.depth)?.difficulty ?? w.depth);
      count += Math.min(3, Math.max(0, floor - kind.floors[0]));
    }
    for (let n = 0; n < count; n++) {
      const cell = cells[placed];
      if (!cell) return;
      const monster = spawnMonster(w, member.kind, cell.x + 0.5, cell.y + 0.5, awake, pack);
      if (rewardless) monster.rewardless = true;
      placed++;
    }
  });
  return placed;
}

/** Fills a new floor: a sleeping band in every room but the one the hero arrives in, two in a big one. */
export function fillFloor(w: World): void {
  w.rooms.forEach((room, i) => {
    if (i === 0) return;
    const bands = room.w * room.h >= 110 ? 2 : 1;
    for (let b = 0; b < bands; b++) {
      const cx = room.x + 1 + Math.floor(w.rng() * Math.max(1, room.w - 2));
      const cy = room.y + 1 + Math.floor(w.rng() * Math.max(1, room.h - 2));
      placePack(w, pickPack(w), cx, cy, false, (x, y) => inRoom(room, x, y));
    }
  });
  w.nextBand = DUNGEON.calm;
}

/**
 * The floor does not stay quiet: once the calm is over, bands come up the stairs, awake and
 * looking for the hero, and they come sooner the longer the hero stays.
 */
export function lingering(w: World, dt: number): void {
  w.nextBand -= dt;
  if (w.nextBand > 0) return;
  w.nextBand =
    w.floorTime >= DUNGEON.floorLimit
      ? DUNGEON.overdueBandEvery
      : Math.max(DUNGEON.bandLeast, DUNGEON.bandEvery - w.floorTime * DUNGEON.bandSooner);
  if (w.monsters.length >= DUNGEON.most) return;

  // By the stairs farthest by foot that the hero cannot see; never the ones underfoot.
  const far = (s: { x: number; y: number }): number => {
    const d = w.flow.dist[s.y * w.grid.w + s.x] ?? FAR;
    return d === FAR ? -1 : d;
  };
  const hidden = w.stairs.filter((s) => !w.visible[s.y * w.grid.w + s.x] && far(s) > 10);
  const from = (hidden.length ? hidden : [...w.stairs]).sort((a, b) => far(b) - far(a))[0];
  if (from) placePack(w, pickPack(w), from.x, from.y, true, (x, y) => walkable(w.grid, x, y), w.floorTime >= DUNGEON.floorLimit);
}
