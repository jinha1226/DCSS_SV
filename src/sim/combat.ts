import { HERO } from '../data/hero';
import { POISON } from '../data/monsters';
import { DUNGEON } from '../data/packs';
import { hurtHero, wake } from './effects';
import { FAR } from './flow';
import { walkable } from './grid';
import type { Monster, World } from './types';

/** How quickly a thrown-back monster slows, per second. */
export const KNOCK_FADE = 14;

/** A noise at the hero's feet: every sleeper within `steps` by foot wakes, and its band with it. */
export function noise(w: World, steps: number): void {
  for (const m of w.monsters) {
    if (m.awake) continue;
    const d = w.flow.dist[Math.floor(m.y) * w.grid.w + Math.floor(m.x)] ?? FAR;
    if (d <= steps) wake(w, m);
  }
}

function strike(w: World, m: Monster, amount: number, knock: number, by: 'axe' | 'horns' | 'throw', dx: number, dy: number): void {
  const d = Math.hypot(dx, dy);
  m.hp -= amount;
  m.flash = 0.12;
  wake(w, m);
  m.kx = d > 1e-4 ? (dx / d) * knock : w.hero.facing * knock;
  m.ky = d > 1e-4 ? (dy / d) * knock : 0;
  w.events.push({ type: 'hit', x: m.x, y: m.y, amount, by });
  if (m.hp <= 0) {
    w.kills++;
    w.events.push({ type: 'kill', x: m.x, y: m.y });
  }
}

/** The hero's own body: poison bites, and health comes back by itself when it does not. */
function mend(w: World, dt: number): void {
  const hero = w.hero;
  if (hero.hurt > 0) hero.hurt -= dt;
  if (hero.poison > 0) {
    hero.poison -= dt;
    hero.hp = Math.max(0, hero.hp - POISON * dt);
    if (hero.hp <= 0) w.over = true;
  } else {
    hero.hp = Math.min(hero.maxHp, hero.hp + HERO.regen * dt);
  }
}

/**
 * What a throw would be aimed at: a monster in plain view and in range. Those that throw come
 * first, then others that are awake, and a sleeper only when nothing else is there; the nearest
 * of each.
 */
export function throwTarget(w: World): Monster | undefined {
  let best: Monster | undefined;
  let bestRank = Infinity;
  for (const m of w.monsters) {
    if (m.hp <= 0 || !w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]) continue;
    const d = Math.hypot(m.x - w.hero.x, m.y - w.hero.y);
    if (d > HERO.thrown.range) continue;
    const rank = (m.stats.throws && m.awake ? 0 : m.awake ? 100 : 200) + d;
    if (rank < bestRank) {
      bestRank = rank;
      best = m;
    }
  }
  return best;
}

/** The one blow the player asks for: a boomerang at whatever `throwTarget` picks. */
function throwNow(w: World): void {
  const hero = w.hero;
  const target = throwTarget(w);
  if (!target) return;
  const dx = target.x - hero.x;
  const dy = target.y - hero.y;
  const d = Math.hypot(dx, dy) || 1;
  const t = HERO.thrown;
  w.shots.push({ x: hero.x, y: hero.y, px: hero.x, py: hero.y, vx: (dx / d) * t.speed, vy: (dy / d) * t.speed, damage: t.damage, left: (t.range + 1.5) / t.speed, mine: true });
  hero.throwing = t.every;
  if (Math.abs(dx) > 0.15) hero.facing = dx < 0 ? -1 : 1;
  w.events.push({ type: 'throw', x: hero.x, y: hero.y });
}

/** Things in the air fly straight and stop at walls. A stone strikes the hero; the hero's own throw strikes the first monster it meets. */
function flyShots(w: World, dt: number): void {
  let kept = 0;
  for (const s of w.shots) {
    s.px = s.x;
    s.py = s.y;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.left -= dt;
    if (s.left <= 0 || !walkable(w.grid, Math.floor(s.x), Math.floor(s.y))) continue;
    if (s.mine) {
      const hit = w.monsters.find((m) => m.hp > 0 && Math.hypot(m.x - s.x, m.y - s.y) <= m.stats.radius + 0.2);
      if (hit) {
        strike(w, hit, s.damage, HERO.thrown.knock, 'throw', s.vx, s.vy);
        continue;
      }
    } else if (Math.hypot(s.x - w.hero.x, s.y - w.hero.y) <= HERO.radius + 0.12) {
      hurtHero(w, s.damage);
      continue;
    }
    w.shots[kept++] = s;
  }
  w.shots.length = kept;
}

/**
 * The hero's blows. The axe and the horns need no asking: the axe cuts everything in reach as
 * often as it can, and the horns butt away the nearest monster that has closed in. A throw is
 * made when the player asks for one.
 */
export function heroStrikes(w: World, dt: number, wantsThrow: boolean): void {
  const hero = w.hero;
  mend(w, dt);
  flyShots(w, dt);
  if (w.over) return;
  hero.swing -= dt;
  hero.butt -= dt;
  if (hero.throwing > 0) hero.throwing -= dt;
  if (wantsThrow && hero.throwing <= 0) throwNow(w);

  if (hero.swing <= 0) {
    let any = false;
    for (const m of w.monsters) {
      if (m.hp <= 0 || Math.hypot(m.x - hero.x, m.y - hero.y) - m.stats.radius > HERO.axe.reach) continue;
      if (!any) w.events.push({ type: 'swing', x: hero.x, y: hero.y, reach: HERO.axe.reach + 0.3 });
      any = true;
      strike(w, m, HERO.axe.damage, HERO.axe.knock, 'axe', m.x - hero.x, m.y - hero.y);
    }
    hero.swing = any ? HERO.axe.every : 0;
    if (any) noise(w, DUNGEON.loud);
  }

  if (hero.butt <= 0) {
    let nearest: Monster | undefined;
    let best = Infinity;
    for (const m of w.monsters) {
      if (m.hp <= 0) continue;
      const d = Math.hypot(m.x - hero.x, m.y - hero.y) - m.stats.radius;
      if (d <= HERO.horns.reach && d < best) {
        best = d;
        nearest = m;
      }
    }
    if (nearest) {
      strike(w, nearest, HERO.horns.damage, HERO.horns.knock, 'horns', nearest.x - hero.x, nearest.y - hero.y);
      nearest.stun = HERO.horns.stun;
      nearest.wind = -1;
      hero.butt = HERO.horns.every;
    } else {
      hero.butt = 0;
    }
  }

  // The fallen leave the floor.
  let kept = 0;
  for (const m of w.monsters) if (m.hp > 0) w.monsters[kept++] = m;
  w.monsters.length = kept;
}
