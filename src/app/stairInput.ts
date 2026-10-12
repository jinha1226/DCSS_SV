import type { World } from '../sim/types';

/** Stair traversal counts as a deliberate action even when SUPERHOT pauses ordinary idle time. */
export function stairHoldActive(w: Pick<World, 'stairs' | 'hero' | 'depth' | 'stairsArmed'>): boolean {
  if (!w.stairsArmed) return false;
  const x = Math.floor(w.hero.x);
  const y = Math.floor(w.hero.y);
  return w.stairs.some((stair) => stair.x === x && stair.y === y && (stair.down || w.depth > 1));
}
