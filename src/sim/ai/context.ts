import { monsterSpellMana, spellData } from '../../data/spells';
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
  /** Longest usable weapon/spell reach, used for positioning. */
  readonly effectiveRange: number;
  readonly preferredRange: number;
  readonly visible: boolean;
  readonly ready: boolean;
  readonly hpRatio: number;
}

export function monsterContext(world: World, monster: Monster): MonsterContext {
  const dx = world.hero.x - monster.x;
  const dy = world.hero.y - monster.y;
  const weapon = monster.weapon;
  const reach = world.heroDef.radius + (weapon && weapon.family !== 'ranged' ? weapon.range : monster.stats.reach);
  const rangedRange = weapon?.family === 'ranged' ? weapon.range : (monster.stats.throws?.range ?? 0);
  const spells = monster.stats.ai?.spells ?? [];
  const magicRange = Math.max(
    0,
    ...spells.map((id) => {
      const spell = spellData(id);
      return spell.damage !== undefined && monster.maxMana >= monsterSpellMana(spell) ? (spell.range ?? 0) : 0;
    }),
  );
  const effectiveRange = Math.max(rangedRange, magicRange);
  const preferredRange = monster.stats.ai?.preferredRange ?? monster.stats.throws?.keep ?? (effectiveRange ? effectiveRange * 0.6 : 0);
  return {
    world,
    monster,
    dx,
    dy,
    distance: Math.hypot(dx, dy),
    reach,
    rangedRange,
    effectiveRange,
    preferredRange,
    visible: world.visible[Math.floor(monster.y) * world.grid.w + Math.floor(monster.x)] === 1,
    ready: monster.rest <= 0,
    hpRatio: Math.max(0, Math.min(1, monster.hp / monster.maxHp)),
  };
}
