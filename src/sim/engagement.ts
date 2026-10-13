import { DUNGEON } from '../data/packs';
import type { World } from './types';

const GRACE = 0.12;

/** Whether a living, active melee enemy currently pins the hero's movement. */
export function heroEngaged(w: World): boolean {
  return w.monsters.some((monster) => {
    if (monster.hp <= 0 || !monster.awake || monster.stun > 0 || monster.fear > 0 || monster.stats.damage <= 0) return false;
    const dx = w.hero.x - monster.x;
    const dy = w.hero.y - monster.y;
    const reach = w.heroDef.radius + (monster.weapon && monster.weapon.family !== 'ranged' ? monster.weapon.range : monster.stats.reach);
    return dx * dx + dy * dy <= (reach + GRACE) ** 2;
  });
}

export function engagementSlow(w: World): number {
  return heroEngaged(w) ? DUNGEON.melee.engagedSlow : 1;
}
