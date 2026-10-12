import type { Branch } from './dungeonGraph';
import { Cell, cellAt } from './grid';
import { placePack } from './packs';
import { PACKS } from '../data/packs';
import type { World } from './types';

export type Objective = { readonly kind: 'rune' | 'orb'; readonly x: number; readonly y: number; readonly branch?: Branch };

export function objectiveFor(w: World): Objective | undefined {
  const node = w.dungeonGraph.nodes.get(w.depth);
  if (!node || node.floor !== 3) return undefined;
  const isRune = w.dungeonGraph.runeBranches.includes(node.branch);
  if (!isRune && node.branch !== 'Zot') return undefined;
  if (isRune && w.runes.has(node.branch)) return undefined;
  if (node.branch === 'Zot' && w.orbCollected) return undefined;
  const room = w.rooms[w.rooms.length - 1];
  if (!room) return undefined;
  const cx = Math.floor(room.x + room.w / 2);
  const cy = Math.floor(room.y + room.h / 2);
  for (let radius = 0; radius < Math.max(room.w, room.h); radius++) {
    for (let y = cy - radius; y <= cy + radius; y++)
      for (let x = cx - radius; x <= cx + radius; x++)
        if (cellAt(w.grid, x, y) === Cell.Floor && !w.stairs.some((stair) => stair.x === x && stair.y === y))
          return { kind: isRune ? 'rune' : 'orb', x: x + 0.5, y: y + 0.5, ...(isRune ? { branch: node.branch } : {}) };
  }
  return undefined;
}

/** An objective is guarded on initial generation, never on a floor revisit. */
export function placeObjectiveGuards(w: World): void {
  const objective = objectiveFor(w);
  if (!objective || !w.monstersEnabled) return;
  const node = w.dungeonGraph.nodes.get(w.depth)!;
  const pack = PACKS.find((candidate) => candidate.id === node.branch.toLowerCase() + '_guard');
  if (!pack) return;
  const cx = Math.floor(objective.x);
  const cy = Math.floor(objective.y);
  placePack(w, pack, cx, cy, false, (x, y) => x !== cx || y !== cy);
}

export function collectObjective(w: World): void {
  const objective = objectiveFor(w);
  if (!objective || Math.hypot(w.hero.x - objective.x, w.hero.y - objective.y) > 0.6) return;
  // The guardian zone must be cleared before its reward can be claimed.
  if (w.monsters.some((monster) => monster.hp > 0 && Math.hypot(monster.x - objective.x, monster.y - objective.y) < 3)) return;
  if (objective.kind === 'rune' && objective.branch) {
    w.runes.add(objective.branch);
    w.events.push({ type: 'rune', branch: objective.branch });
  } else if (objective.kind === 'orb' && w.dungeonGraph.runeBranches.every((branch) => w.runes.has(branch))) {
    w.orbCollected = true;
    w.won = true;
    w.over = true;
    w.events.push({ type: 'orb' });
  }
}
