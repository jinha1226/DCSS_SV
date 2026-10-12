import { effectValue, gainExperience } from './skills';
import type { Monster, World } from './types';

export function recordKill(w: World, m: Monster): boolean {
  if (m.hp > 0) return false;
  w.kills++;
  if (!m.rewardless) {
    gainExperience(w, m.stats.xp);
    const heal = effectValue(w, 'fighting.healKill');
    if (heal > 0) w.hero.hp = Math.min(w.hero.maxHp, w.hero.hp + heal);
  }
  w.events.push({ type: 'kill', x: m.x, y: m.y, name: m.kind.name });
  return true;
}
