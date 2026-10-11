import type { HeadbuttBackTrait, HopTrait, HornTrait, TraitData } from '../data/traits';
import { recordKill } from './kills';
import type { Monster, World } from './types';

export function trait<T extends TraitData['id']>(w: World, id: T): Extract<TraitData, { readonly id: T }> | undefined {
  return w.heroDef.traits.find((entry) => entry.id === id) as Extract<TraitData, { readonly id: T }> | undefined;
}
export const hornTrait = (w: World): HornTrait | undefined => trait(w, 'horns');
export const headbuttBackTrait = (w: World): HeadbuttBackTrait | undefined => trait(w, 'headbutt_back');
export const hopTrait = (w: World): HopTrait | undefined => trait(w, 'hop');
export function hornDamage(w: World): number {
  const h = hornTrait(w);
  return h ? h.damage + Math.floor(w.hero.level / h.damageEveryLevel) * h.damageGain : 0;
}
export function hornEvery(w: World): number {
  const h = hornTrait(w);
  return h ? Math.max(h.minEvery, h.every - Math.floor(w.hero.level / h.speedEveryLevel) * h.speedGain) : Infinity;
}
export function headbuttBack(w: World, source: Monster | undefined, kind: 'melee' | 'stone'): boolean {
  const horns = hornTrait(w);
  if (kind !== 'melee' || !source || !headbuttBackTrait(w) || !horns || source.hp <= 0) return false;
  const dx = source.x - w.hero.x,
    dy = source.y - w.hero.y,
    d = Math.hypot(dx, dy) || 1,
    damage = hornDamage(w);
  source.hp -= damage;
  source.flash = 0.12;
  source.kx = (dx / d) * horns.knock;
  source.ky = (dy / d) * horns.knock;
  source.stun = Math.max(source.stun, horns.stun);
  source.wind = -1;
  w.events.push({ type: 'hit', x: source.x, y: source.y, amount: damage, by: 'headbutt_back' });
  recordKill(w, source);
  return true;
}
