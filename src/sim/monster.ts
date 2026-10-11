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
const GRACE = 0.12,
  STRAIGHT = 14,
  BUMP = 1.4;
type Stride = { vx: number; vy: number };
function speedOf(m: Monster): number {
  return m.stats.speed * (m.slow > 0 ? 1 - m.slowScale : 1);
}
function throwerTurn(w: World, m: Monster, dt: number, dx: number, dy: number, d: number, inView: boolean): Stride {
  const t = m.stats.throws!,
    speed = speedOf(m);
  if (m.wind >= 0) {
    m.wind -= dt;
    if (m.wind < 0) {
      w.shots.push({
        x: m.x,
        y: m.y,
        px: m.x,
        py: m.y,
        vx: (dx / d) * t.speed,
        vy: (dy / d) * t.speed,
        damage: m.stats.damage,
        left: (t.range + 2) / t.speed,
        mine: false,
        pierce: 0,
        returns: false,
        returning: false,
        hit: [],
      });
      m.rest = m.stats.rest;
    }
    return { vx: 0, vy: 0 };
  }
  if (!inView || d > t.range) {
    const way = downhill(w.flow, w.grid, m.x, m.y);
    return way ? { vx: way.x * speed, vy: way.y * speed } : { vx: 0, vy: 0 };
  }
  if (m.rest <= 0) {
    m.wind = m.stats.windup;
    return { vx: 0, vy: 0 };
  }
  return d < t.keep ? { vx: (-dx / d) * speed, vy: (-dy / d) * speed } : { vx: 0, vy: 0 };
}
export function thinkMonster(w: World, m: Monster, dt: number): Stride {
  const still = { vx: 0, vy: 0 },
    hero = w.hero,
    dx = hero.x - m.x,
    dy = hero.y - m.y,
    d = Math.hypot(dx, dy) || 1e-6;
  const inView = w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)] === 1;
  if (m.flash > 0) m.flash -= dt;
  if (m.slow > 0) {
    m.slow -= dt;
    if (m.slow <= 0) m.slowScale = 0;
  }
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
  const speed = speedOf(m);
  if (m.flit > 0) {
    m.flit -= dt;
    return { vx: m.fx * speed, vy: m.fy * speed };
  }
  const reach = w.heroDef.radius + m.stats.reach;
  if (m.wind >= 0) {
    m.wind -= dt;
    if (m.wind < 0) {
      if (d <= reach + GRACE) {
        const landed = hurtHero(w, m.stats.damage, 'melee', m);
        if (landed && m.stats.poison) hero.poison = Math.max(hero.poison, m.stats.poison);
      }
      m.rest = m.stats.rest;
      if (m.stats.flits) {
        const angle = Math.atan2(-dy, -dx) + (w.rng() - 0.5) * 2.4;
        m.flit = m.stats.flits * (0.6 + w.rng() * 0.8);
        m.fx = Math.cos(angle);
        m.fy = Math.sin(angle);
      }
    }
    return still;
  }
  if (d <= reach && m.rest <= 0) {
    m.wind = m.stats.windup;
    return still;
  }
  if (d <= w.heroDef.radius + m.stats.radius + 0.02) return still;
  if (inView && d < STRAIGHT) return { vx: (dx / d) * speed, vy: (dy / d) * speed };
  const way = downhill(w.flow, w.grid, m.x, m.y);
  return way ? { vx: way.x * speed, vy: way.y * speed } : still;
}
