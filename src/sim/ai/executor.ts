import { hurtHero } from '../effects';
import { downhill } from '../flow';
import { castMonsterSpell } from '../spells';
import { activateItem } from '../itemEffects';
import type { Monster } from '../types';
import type { ActionCandidate } from './actions';
import type { MonsterContext } from './context';

export interface Stride {
  vx: number;
  vy: number;
}

const STILL: Stride = { vx: 0, vy: 0 };
const GRACE = 0.12;
const STRAIGHT = 14;

function speedOf(monster: Monster): number {
  return monster.stats.speed * (monster.slow > 0 ? 1 - monster.slowScale : 1);
}

function towardHero(context: MonsterContext): Stride {
  const { world, monster, dx, dy, distance } = context;
  const speed = speedOf(monster);
  if (distance <= world.heroDef.radius + monster.stats.radius + 0.02) return STILL;
  if (context.visible && distance < STRAIGHT && distance > 1e-6) {
    return { vx: (dx / distance) * speed, vy: (dy / distance) * speed };
  }
  const direction = downhill(world.flow, world.grid, monster.x, monster.y);
  return direction ? { vx: direction.x * speed, vy: direction.y * speed } : STILL;
}

/** Initiate a decision. Attacks lock their action until windup resolves. */
export function executeMonsterAction(context: MonsterContext, choice: ActionCandidate): Stride {
  const m = context.monster;
  switch (choice.action) {
    case 'melee':
    case 'ranged':
    case 'spell':
    case 'item':
      m.attackMode = choice.action;
      m.queuedSpell = choice.spellId;
      m.queuedItem = choice.itemId;
      if (choice.action === 'melee') {
        m.wind = -1;
        m.lunge = 0.12;
        finishMonsterAttack(context);
        return STILL;
      }
      m.wind = m.stats.windup;
      return STILL;
    case 'approach':
      return towardHero(context);
    case 'retreat': {
      const d = context.distance || 1;
      const speed = speedOf(m);
      return { vx: (-context.dx / d) * speed, vy: (-context.dy / d) * speed };
    }
    case 'hold':
      return STILL;
  }
}

/** Completing attacks is deliberately independent of how they were chosen. */
export function finishMonsterAttack(context: MonsterContext): void {
  const { world: w, monster: m, distance: d, reach, rangedRange, visible, dx, dy } = context;
  if (m.attackMode === 'melee' && d <= reach + GRACE) {
    const damage = m.weapon && m.weapon.family !== 'ranged' ? m.weapon.damage : m.stats.damage;
    const landed = hurtHero(w, damage, 'melee', m, m.stats.elemental);
    if (landed && m.stats.poison) {
      const resist = Math.max(0, w.heroDef.resists.poison ?? 0);
      w.hero.poison = Math.max(w.hero.poison, m.stats.poison / (1 + resist));
    }
    if (landed && m.stats.constrict) w.hero.constricted = Math.max(w.hero.constricted, m.stats.constrict);
  } else if (m.attackMode === 'ranged' && visible && d > reach && d <= rangedRange && d > 1e-6) {
    const bow = m.weapon?.family === 'ranged' ? m.weapon : undefined;
    const speed = bow?.projectileSpeed ?? m.stats.throws?.speed ?? 10;
    w.shots.push({
      x: m.x,
      y: m.y,
      px: m.x,
      py: m.y,
      vx: (dx / d) * speed,
      vy: (dy / d) * speed,
      damage: bow?.damage ?? m.stats.damage,
      left: (rangedRange + 2) / speed,
      mine: false,
      pierce: 0,
      returns: false,
      returning: false,
      hit: [],
      ...(bow ? { arrow: true } : {}),
      sourceMonster: m,
    });
  } else if (m.attackMode === 'spell' && m.queuedSpell) {
    castMonsterSpell(w, m, m.queuedSpell);
  } else if (m.attackMode === 'item' && m.queuedItem && (m.itemUses[m.queuedItem] ?? 0) > 0) {
    if (activateItem(w, m.queuedItem, 'monster', m)) m.itemUses[m.queuedItem]!--;
  }
  // DCSS: a monster's attack rate comes from its speed and action energy, not from the
  // weapon it carries. Shots and spells use their own energy (missile, spell).
  m.rest = m.attackMode === 'ranged' ? m.stats.restMissile : m.attackMode === 'spell' ? m.stats.restSpell : m.stats.rest;
  m.queuedSpell = undefined;
  m.queuedItem = undefined;
  if (m.stats.flits && m.attackMode === 'melee') {
    const angle = Math.atan2(-dy, -dx) + (w.rng() - 0.5) * 2.4;
    m.flit = m.stats.flits * (0.6 + w.rng() * 0.8);
    m.fx = Math.cos(angle);
    m.fy = Math.sin(angle);
  }
}

/** Windup and post-hit movement override further utility choices. */
export function continueMonsterAction(context: MonsterContext, dt: number): Stride | undefined {
  const m = context.monster;
  if (m.wind >= 0) {
    m.wind -= dt;
    if (m.wind < 0) finishMonsterAttack(context);
    return STILL;
  }
  if (m.flit > 0) {
    m.flit -= dt;
    const speed = speedOf(m);
    return { vx: m.fx * speed, vy: m.fy * speed };
  }
  return undefined;
}
