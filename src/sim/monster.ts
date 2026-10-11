import { monsterKind } from '../data/monsters';
import { plainWeapon } from '../data/items';
import { DUNGEON } from '../data/packs';
import { monsterContext } from './ai/context';
import { continueMonsterAction, executeMonsterAction, type Stride } from './ai/executor';
import { selectMonsterAction } from './ai/selector';
import { rankMonsterActions } from './ai/utility';
import { wake } from './effects';
import type { Monster, World } from './types';

const BUMP = 1.4;
const STILL: Stride = { vx: 0, vy: 0 };

export function spawnMonster(w: World, id: string, x: number, y: number, awake: boolean, pack = w.nextPack++): Monster {
  const kind = monsterKind(id);
  const hp = Math.round(kind.stats.hp * (1 + DUNGEON.tougher * (w.depth - 1)));
  const mana = kind.stats.mana ?? 0;
  const itemUses: Record<string, number> = {};
  for (const itemId of kind.stats.items ?? []) itemUses[itemId] = (itemUses[itemId] ?? 0) + 1;
  const m: Monster = {
    kind,
    stats: kind.stats,
    pack,
    maxHp: hp,
    x,
    y,
    px: x,
    py: y,
    hp,
    mana,
    maxMana: mana,
    spellCooldown: 0,
    guard: 0,
    fear: 0,
    confusion: 0,
    itemUses,
    ...(kind.stats.weapon ? { weapon: plainWeapon(kind.stats.weapon, 'monster-' + id) } : {}),
    awake,
    wind: -1,
    attackMode: 'melee',
    queuedSpell: undefined,
    queuedItem: undefined,
    rest: w.rng() * 0.4,
    stun: 0,
    flit: 0,
    fx: 0,
    fy: 0,
    kx: 0,
    ky: 0,
    flash: 0,
    slow: 0,
    slowScale: 0,
    burning: 0,
    burnDamage: 0,
    facing: -1,
  };
  w.monsters.push(m);
  return m;
}

/** Diagnostics for the UI and tests; uses the actual AI decision pipeline. */
export function monsterActions(w: World, m: Monster) {
  return rankMonsterActions(monsterContext(w, m));
}

/**
 * Lifecycle only: status timers, perception, locked attack, new decision.
 * No monster-specific behaviour tree or spell/weapon effects belong here.
 */
export function thinkMonster(w: World, m: Monster, dt: number): Stride {
  const dx = w.hero.x - m.x;
  const d = Math.hypot(dx, w.hero.y - m.y);
  const visible = w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)] === 1;
  if (m.flash > 0) m.flash -= dt;
  if (m.slow > 0) {
    m.slow -= dt;
    if (m.slow <= 0) m.slowScale = 0;
  }
  if (m.spellCooldown > 0) m.spellCooldown = Math.max(0, m.spellCooldown - dt);
  if (m.guard > 0) m.guard = Math.max(0, m.guard - dt);
  if (m.fear > 0) m.fear = Math.max(0, m.fear - dt);
  if (m.confusion > 0) m.confusion = Math.max(0, m.confusion - dt);
  m.mana = Math.min(m.maxMana, m.mana + (m.stats.manaRegen ?? 0) * dt);
  if (!m.awake) {
    if (d > BUMP && (!visible || d > m.stats.notice)) return STILL;
    wake(w, m);
  }
  if (m.rest > 0) m.rest -= dt;
  if (m.stun > 0) {
    m.stun -= dt;
    m.wind = -1;
    m.queuedSpell = undefined;
    m.queuedItem = undefined;
    return STILL;
  }
  if (Math.abs(dx) > 0.05) m.facing = dx < 0 ? -1 : 1;
  if (m.fear > 0) {
    m.wind = -1;
    const away = Math.hypot(dx, w.hero.y - m.y) || 1;
    return { vx: (-dx / away) * m.stats.speed, vy: ((m.y - w.hero.y) / away) * m.stats.speed };
  }
  if (m.confusion > 0) {
    m.wind = -1;
    const angle = w.rng() * Math.PI * 2;
    return { vx: Math.cos(angle) * m.stats.speed * 0.7, vy: Math.sin(angle) * m.stats.speed * 0.7 };
  }
  const context = monsterContext(w, m);
  const locked = continueMonsterAction(context, dt);
  if (locked) return locked;
  return executeMonsterAction(context, selectMonsterAction(context));
}
