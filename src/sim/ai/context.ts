import type { Monster, World } from '../types';

/** Read-only snapshot used by every action and scorer during one decision. */
export interface MonsterContext {
  readonly world: World;
  readonly monster: Monster;
  readonly dx: number;
  readonly dy: number;
  readonly distance: number;
  readonly reach: number;
  readonly rangedRange: number;
  readonly preferredRange: number;
  readonly visible: boolean;
  readonly ready: boolean;
  readonly hpRatio: number;
}

export function monsterContext(world: World, monster: Monster): MonsterContext {
  const dx = world.hero.x - monster.x;
  const dy = world.hero.y - monster.y;
  const weapon = monster.weapon;
  const reach = world.heroDef.radius + (weapon && weapon.family !== 'bow' ? weapon.range : monster.stats.reach);
  const rangedRange = weapon?.family === 'bow' ? weapon.range : monster.stats.throws?.range ?? 0;
  const preferredRange = monster.stats.ai?.preferredRange ?? monster.stats.throws?.keep ?? (rangedRange ? rangedRange * 0.5 : 0);
  return {
    world,
    monster,
    dx,
    dy,
    distance: Math.hypot(dx, dy),
    reach,
    rangedRange,
    preferredRange,
    visible: world.visible[Math.floor(monster.y) * world.grid.w + Math.floor(monster.x)] === 1,
    ready: monster.rest <= 0,
    hpRatio: Math.max(0, Math.min(1, monster.hp / monster.maxHp)),
  };
}
