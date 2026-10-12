import type { ResistName } from '../data/items';
import { damageAfterDefense, type DamageType } from './damage';
import { wake } from './effects';
import { recordKill } from './kills';
import type { Monster, SimEvent, World } from './types';

type MonsterHitKind = Extract<SimEvent, { type: 'hit' }>['by'];

export interface MonsterHitResult {
  readonly damage: number;
  readonly killed: boolean;
}

/**
 * All hero-originated melee, ranged, spell and item effects use the same
 * monster defence/kill/event pipeline. AI never applies damage directly.
 * Monster guard is a shared defensive status granted by spells.json.
 */
export function hurtMonster(
  w: World,
  monster: Monster,
  amount: number,
  type: DamageType = 'physical',
  by: MonsterHitKind = 'spell',
): MonsterHitResult {
  if (monster.hp <= 0 || monster.guard > 0) return { damage: 0, killed: false };
  const scale = monster.vulnerable > 0 ? 1 + monster.vulnerableScale : 1;
  const armour = Math.max(0, (monster.stats.armour ?? 0) - (monster.rot > 0 ? monster.rotArmour : 0));
  const damage = damageAfterDefense(amount * scale, type, armour, monster.stats.resists);
  monster.hp -= damage;
  monster.flash = 0.12;
  wake(w, monster);
  if (type === 'physical') {
    w.events.push({ type: 'hit', x: monster.x, y: monster.y, amount: damage, by });
  } else {
    w.events.push({ type: 'elemental', x: monster.x, y: monster.y, amount: damage, element: type as ResistName, target: 'monster' });
  }
  return { damage, killed: recordKill(w, monster) };
}
