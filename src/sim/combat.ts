import { HERO } from '../data/hero';
import type { Monster, World } from './types';

/** How quickly a thrown-back monster slows, per second. */
export const KNOCK_FADE = 14;

function strike(w: World, m: Monster, amount: number, knock: number, by: 'axe' | 'horns'): void {
  const hero = w.hero;
  let dx = m.x - hero.x;
  let dy = m.y - hero.y;
  const d = Math.hypot(dx, dy);
  if (d > 1e-4) {
    dx /= d;
    dy /= d;
  } else {
    dx = hero.facing;
    dy = 0;
  }
  m.hp -= amount;
  m.flash = 0.12;
  m.awake = true;
  m.kx = dx * knock;
  m.ky = dy * knock;
  w.events.push({ type: 'hit', x: m.x, y: m.y, amount, by });
  if (m.hp <= 0) {
    w.kills++;
    w.events.push({ type: 'kill', x: m.x, y: m.y });
  }
}

/**
 * The hero's blows, none of which the player asks for: the axe cuts everything in reach as often
 * as it can, and the horns butt away the nearest monster that has closed in.
 */
export function heroStrikes(w: World, dt: number): void {
  const hero = w.hero;
  if (hero.hurt > 0) hero.hurt -= dt;
  hero.hp = Math.min(hero.maxHp, hero.hp + HERO.regen * dt);
  hero.swing -= dt;
  hero.butt -= dt;

  if (hero.swing <= 0) {
    let any = false;
    for (const m of w.monsters) {
      if (m.hp <= 0 || Math.hypot(m.x - hero.x, m.y - hero.y) > HERO.axe.reach) continue;
      if (!any) w.events.push({ type: 'swing', x: hero.x, y: hero.y, reach: HERO.axe.reach });
      any = true;
      strike(w, m, HERO.axe.damage, HERO.axe.knock, 'axe');
    }
    hero.swing = any ? HERO.axe.every : 0;
  }

  if (hero.butt <= 0) {
    let nearest: Monster | undefined;
    let best: number = HERO.horns.reach;
    for (const m of w.monsters) {
      if (m.hp <= 0) continue;
      const d = Math.hypot(m.x - hero.x, m.y - hero.y);
      if (d <= best) {
        best = d;
        nearest = m;
      }
    }
    if (nearest) {
      strike(w, nearest, HERO.horns.damage, HERO.horns.knock, 'horns');
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
