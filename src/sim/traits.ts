import type { HeadbuttBackTrait, HornTrait, TraitData } from '../data/traits';
import { recordKill } from './kills';
import type { Monster, World } from './types';

export function trait<T extends TraitData['id']>(w: World, id: T): Extract<TraitData, { readonly id: T }> | undefined {
  return w.heroDef.traits.find((entry) => entry.id === id) as Extract<TraitData, { readonly id: T }> | undefined;
}

export function hornTrait(w: World): HornTrait | undefined {
  return trait(w, 'horns');
}

export function headbuttBackTrait(w: World): HeadbuttBackTrait | undefined {
  return trait(w, 'headbutt_back');
}

export function hornDamage(w: World): number {
  const horns = hornTrait(w);
  if (!horns) return 0;
  return horns.damage + Math.floor(w.hero.level / horns.damageEveryLevel) * horns.damageGain;
}

export function hornEvery(w: World): number {
  const horns = hornTrait(w);
  if (!horns) return Infinity;
  return Math.max(horns.minEvery, horns.every - Math.floor(w.hero.level / horns.speedEveryLevel) * horns.speedGain);
}

export function headbuttBack(w: World, source: Monster | undefined, kind: 'melee' | 'stone'): boolean {
  const horns = hornTrait(w);
  if (kind !== 'melee' || !source || !headbuttBackTrait(w) || !horns || source.hp <= 0) return false;
  const dx = source.x - w.hero.x;
  const dy = source.y - w.hero.y;
  const distance = Math.hypot(dx, dy) || 1;
  const damage = hornDamage(w);
  source.hp -= damage;
  source.flash = 0.12;
  source.kx = (dx / distance) * horns.knock;
  source.ky = (dy / distance) * horns.knock;
  source.stun = Math.max(source.stun, horns.stun);
  source.wind = -1;
  w.events.push({ type: 'hit', x: source.x, y: source.y, amount: damage, by: 'headbutt_back' });
  recordKill(w, source);
  return true;
}
