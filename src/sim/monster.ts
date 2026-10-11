import { monsterKind } from '../data/monsters';
import { DUNGEON } from '../data/packs';
import { hurtHero, wake } from './effects';
import { downhill } from './flow';
import type { Monster, World } from './types';

export function spawnMonster(w: World, id: string, x: number, y: number, awake: boolean, pack = w.nextPack++): Monster {
  const kind = monsterKind(id);
  const hp = Math.round(kind.stats.hp * (1 + DUNGEON.tougher * (w.depth - 1)));
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
    awake,
    wind: -1,
    // A little apart, so a band does not strike as one.
    rest: w.rng() * 0.4,
    stun: 0,
    flit: 0,
    fx: 0,
    fy: 0,
    kx: 0,
    ky: 0,
    flash: 0,
    facing: -1,
  };
  w.monsters.push(m);
  return m;
}

/** The blow lands if the hero is still this much outside the monster's reach. */
const GRACE = 0.12;
/** Within this distance and in plain view a monster heads straight for the hero. */
const STRAIGHT = 14;
/** A sleeper this close wakes whether or not it can see the hero. */
const BUMP = 1.4;

type Stride = { vx: number; vy: number };

/** A thrower keeps its distance and lobs stones along a line of sight. */
function throwerTurn(w: World, m: Monster, dt: number, dx: number, dy: number, d: number, inView: boolean): Stride {
  const t = m.stats.throws!;
  if (m.wind >= 0) {
    m.wind -= dt;
    if (m.wind < 0) {
      w.shots.push({ x: m.x, y: m.y, px: m.x, py: m.y, vx: (dx / d) * t.speed, vy: (dy / d) * t.speed, damage: m.stats.damage, left: (t.range + 2) / t.speed, mine: false });
      m.rest = m.stats.rest;
    }
    return { vx: 0, vy: 0 };
  }
  if (!inView || d > t.range) {
    const way = downhill(w.flow, w.grid, m.x, m.y);
    return way ? { vx: way.x * m.stats.speed, vy: way.y * m.stats.speed } : { vx: 0, vy: 0 };
  }
  if (m.rest <= 0) {
    m.wind = m.stats.windup;
    return { vx: 0, vy: 0 };
  }
  // Too close for comfort: it backs away while it waits to throw again.
  return d < t.keep ? { vx: (-dx / d) * m.stats.speed, vy: (-dy / d) * m.stats.speed } : { vx: 0, vy: 0 };
}

/**
 * One monster's turn of thought: it notices the hero, closes in, draws back and strikes.
 * Returns the speed it wants to walk at this step, in cells a second.
 */
export function thinkMonster(w: World, m: Monster, dt: number): Stride {
  const still = { vx: 0, vy: 0 };
  const hero = w.hero;
  const dx = hero.x - m.x;
  const dy = hero.y - m.y;
  const d = Math.hypot(dx, dy) || 1e-6;
  const inView = w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)] === 1;

  if (m.flash > 0) m.flash -= dt;
  if (!m.awake) {
    if (d > BUMP && (!inView || d > m.stats.notice)) return still;
    wake(w, m);
  }
  if (m.rest > 0) m.rest -= dt;
  if (m.stun > 0) {
    m.stun -= dt;
    m.wind = -1;
    return still;
  }
  if (Math.abs(dx) > 0.05) m.facing = dx < 0 ? -1 : 1;
  if (m.stats.throws) return throwerTurn(w, m, dt, dx, dy, d, inView);

  if (m.flit > 0) {
    m.flit -= dt;
    return { vx: m.fx * m.stats.speed, vy: m.fy * m.stats.speed };
  }

  const strike = w.heroDef.radius + m.stats.reach;
  if (m.wind >= 0) {
    // Committed to the blow: it stands and swings, and misses if the hero has stepped away.
    m.wind -= dt;
    if (m.wind < 0) {
      if (d <= strike + GRACE) {
        hurtHero(w, m.stats.damage);
        if (m.stats.poison) hero.poison = Math.max(hero.poison, m.stats.poison);
      }
      m.rest = m.stats.rest;
      if (m.stats.flits) {
        // Off in some direction that is not straight back at the hero.
        const angle = Math.atan2(-dy, -dx) + (w.rng() - 0.5) * 2.4;
        m.flit = m.stats.flits * (0.6 + w.rng() * 0.8);
        m.fx = Math.cos(angle);
        m.fy = Math.sin(angle);
      }
    }
    return still;
  }
  if (d <= strike && m.rest <= 0) {
    m.wind = m.stats.windup;
    return still;
  }
  if (d <= w.heroDef.radius + m.stats.radius + 0.02) return still;

  if (inView && d < STRAIGHT) return { vx: (dx / d) * m.stats.speed, vy: (dy / d) * m.stats.speed };
  const way = downhill(w.flow, w.grid, m.x, m.y);
  return way ? { vx: way.x * m.stats.speed, vy: way.y * m.stats.speed } : still;
}
