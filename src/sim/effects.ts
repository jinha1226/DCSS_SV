import type { Monster, World } from './types';

/** Things that happen to the hero or a monster from more than one place in the rules. */

export function hurtHero(w: World, amount: number): void {
  const hero = w.hero;
  hero.hp = Math.max(0, hero.hp - amount);
  hero.hurt = 0.2;
  w.events.push({ type: 'hurt', x: hero.x, y: hero.y, amount });
  if (hero.hp <= 0) w.over = true;
}

/** Wakes a monster and every other member of its band. */
export function wake(w: World, m: Monster): void {
  if (m.awake) return;
  for (const other of w.monsters) {
    if (other.pack !== m.pack || other.awake) continue;
    other.awake = true;
    // They come to a moment apart.
    other.rest = Math.max(other.rest, w.rng() * 0.5);
  }
  w.events.push({ type: 'wake', x: m.x, y: m.y });
}
