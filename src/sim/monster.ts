import { HERO } from '../data/hero';
import { monsterKind } from '../data/monsters';
import { downhill } from './flow';
import type { Monster, World } from './types';

export function spawnMonster(w: World, id: string, x: number, y: number, awake: boolean): Monster {
  const kind = monsterKind(id);
  const m: Monster = {
    kind,
    stats: kind.stats,
    x,
    y,
    px: x,
    py: y,
    hp: kind.stats.hp,
    awake,
    wind: -1,
    // A little apart, so a band does not strike as one.
    rest: w.rng() * 0.4,
    stun: 0,
    kx: 0,
    ky: 0,
    flash: 0,
    facing: -1,
  };
  w.monsters.push(m);
  return m;
}

/** The blow lands if the hero is still this much inside or outside the monster's reach. */
const GRACE = 0.12;
/** Within this distance and in plain view a monster heads straight for the hero. */
const STRAIGHT = 14;

function land(w: World, m: Monster): void {
  const hero = w.hero;
  hero.hp = Math.max(0, hero.hp - m.stats.damage);
  hero.hurt = 0.2;
  w.events.push({ type: 'hurt', x: hero.x, y: hero.y, amount: m.stats.damage });
  if (hero.hp <= 0) w.over = true;
}

/**
 * One monster's turn of thought: it notices the hero, closes in, draws back and strikes.
 * Returns the speed it wants to walk at this step, in cells a second.
 */
export function thinkMonster(w: World, m: Monster, dt: number): { vx: number; vy: number } {
  const still = { vx: 0, vy: 0 };
  const hero = w.hero;
  const dx = hero.x - m.x;
  const dy = hero.y - m.y;
  const d = Math.hypot(dx, dy);
  const inView = w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)] === 1;

  if (m.flash > 0) m.flash -= dt;
  if (!m.awake) {
    if (!inView || d > m.stats.notice) return still;
    m.awake = true;
  }
  if (m.rest > 0) m.rest -= dt;
  if (m.stun > 0) {
    m.stun -= dt;
    m.wind = -1;
    return still;
  }
  if (Math.abs(dx) > 0.05) m.facing = dx < 0 ? -1 : 1;

  const strike = HERO.radius + m.stats.reach;
  if (m.wind >= 0) {
    // Committed to the blow: it stands and swings, and misses if the hero has stepped away.
    m.wind -= dt;
    if (m.wind < 0) {
      if (d <= strike + GRACE) land(w, m);
      m.rest = m.stats.rest;
    }
    return still;
  }
  if (d <= strike && m.rest <= 0) {
    m.wind = m.stats.windup;
    return still;
  }
  if (d <= HERO.radius + m.stats.radius + 0.02) return still;

  if (inView && d < STRAIGHT) return { vx: (dx / d) * m.stats.speed, vy: (dy / d) * m.stats.speed };
  const way = downhill(w.flow, w.grid, m.x, m.y);
  return way ? { vx: way.x * m.stats.speed, vy: way.y * m.stats.speed } : still;
}
