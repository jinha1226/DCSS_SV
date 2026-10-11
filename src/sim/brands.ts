import { brandData } from '../data/items';
import { resistanceFactor, damageAfterDefense } from './damage';
import type { ResistName } from '../data/items';
import { recordKill } from './kills';
import type { Monster, World } from './types';

function resist(m: Monster, name: string): number {
  return m.stats.resists[name as keyof typeof m.stats.resists] ?? 0;
}

function brandEvent(w: World, m: Monster, type: ResistName, amount: number): void {
  w.events.push({ type: 'elemental', x: m.x, y: m.y, amount, element: type, target: 'monster' });
}

export function emberBurst(w: World, dead: Monster): void {
  if (w.weapon.effect !== 'ember' || dead.burning <= 0) return;
  const flame = brandData('flame')!;
  for (const other of w.monsters) {
    if (other === dead || other.hp <= 0 || Math.hypot(other.x - dead.x, other.y - dead.y) > 1.5) continue;
    const factor = resistanceFactor(resist(other, flame.resist));
    if (factor <= 0) {
      brandEvent(w, other, flame.resist, 0);
      continue;
    }
    other.burning = Math.max(other.burning, (flame.duration ?? 3) * factor);
    other.burnDamage = (flame.damage ?? 2) * factor;
  }
}

export function applyBrand(w: World, m: Monster, brandId: string | undefined): void {
  const brand = brandData(brandId);
  if (!brand) return;
  const factor = resistanceFactor(resist(m, brand.resist));
  if (factor <= 0) {
    brandEvent(w, m, brand.resist, 0);
    return;
  }

  if (brand.id === 'flame') {
    m.burning = Math.max(m.burning, (brand.duration ?? 3) * factor);
    m.burnDamage = (brand.damage ?? 2) * factor;
    const hit = damageAfterDefense(brand.damage ?? 2, brand.resist, 0, m.stats.resists);
    brandEvent(w, m, brand.resist, hit);
    m.hp -= hit;
    if (recordKill(w, m)) emberBurst(w, m);
  } else if (brand.id === 'cold') {
    m.slow = Math.max(m.slow, (brand.duration ?? 2) * factor);
    m.slowScale = Math.max(m.slowScale, (brand.slow ?? 0.3) * factor);
  } else if (brand.id === 'shock') {
    if (w.rng() < (brand.chainShare ?? 0.3)) {
      let target: Monster | undefined;
      let best = 2.6;
      for (const other of w.monsters) {
        if (other === m || other.hp <= 0) continue;
        const d = Math.hypot(other.x - m.x, other.y - m.y);
        if (d < best) {
          best = d;
          target = other;
        }
      }
      if (target) {
        const damage = damageAfterDefense(brand.chainDamage ?? 5, brand.resist, 0, target.stats.resists);
        brandEvent(w, target, brand.resist, damage);
        if (damage > 0) {
          target.hp -= damage;
          target.flash = 0.12;
          if (recordKill(w, target)) emberBurst(w, target);
        }
      }
    }
  } else if (brand.id === 'vampiric') {
    w.hero.hp = Math.min(w.hero.maxHp, w.hero.hp + (brand.heal ?? 1) * factor);
  }
}

export function applyWeaponBrand(w: World, m: Monster): void {
  applyBrand(w, m, w.weapon.brand);
}

export function tickBrands(w: World, dt: number): void {
  for (const m of w.monsters) {
    if (m.hp <= 0 || m.burning <= 0) continue;
    m.burning -= dt;
    const before = m.hp;
    m.hp -= m.burnDamage * dt;
    const shown = Math.floor(before) - Math.floor(Math.max(0, m.hp));
    if (shown > 0) brandEvent(w, m, 'fire', shown);
    if (recordKill(w, m)) emberBurst(w, m);
  }
}
