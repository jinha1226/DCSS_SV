import { EQUIPMENT } from '../data/items';
import { POISON } from '../data/monsters';
import { DUNGEON } from '../data/packs';
import { applyBrand, applyWeaponBrand, emberBurst, tickBrands } from './brands';
import { dropAmmo, weaponOption } from './equipment';
import { hurtHero, wake } from './effects';
import { FAR } from './flow';
import { walkable } from './grid';
import { recordKill } from './kills';
import { effectValue, hasEffect, skillLevel, throwCooldown } from './skills';
import { hornDamage, hornEvery, hornTrait } from './traits';
import type { Monster, Shot, World } from './types';

export const KNOCK_FADE = 14;

export function noise(w: World, steps: number): void {
  for (const m of w.monsters) {
    if (m.awake) continue;
    const d = w.flow.dist[Math.floor(m.y) * w.grid.w + Math.floor(m.x)] ?? FAR;
    if (d <= steps) wake(w, m);
  }
}

function power(w: World, amount: number): number {
  const scale = w.hero.hp <= w.hero.maxHp * 0.3 ? effectValue(w, 'fighting.desperate') : 0;
  return Math.round(amount * (scale || 1));
}

function strike(
  w: World,
  m: Monster,
  amount: number,
  knock: number,
  by: 'axe' | 'arrow' | 'horns' | 'throw',
  dx: number,
  dy: number,
): boolean {
  if (m.hp <= 0) return false;
  amount = power(w, amount);
  const d = Math.hypot(dx, dy);
  m.hp -= amount;
  m.flash = 0.12;
  wake(w, m);
  m.kx = d > 1e-4 ? (dx / d) * knock : w.hero.facing * knock;
  m.ky = d > 1e-4 ? (dy / d) * knock : 0;
  w.events.push({ type: 'hit', x: m.x, y: m.y, amount, by });
  const killed = recordKill(w, m);
  if (killed) emberBurst(w, m);
  return killed;
}

function mend(w: World, dt: number): void {
  const h = w.hero;
  if (h.hurt > 0) h.hurt -= dt;
  if (h.invulnerable > 0) h.invulnerable -= dt;
  if (h.poison > 0) {
    h.poison -= dt;
    h.hp = Math.max(0, h.hp - POISON * dt);
    if (h.hp <= 0) w.over = true;
  } else {
    const regen = w.heroDef.regen * (effectValue(w, 'fighting.regen') || 1);
    h.hp = Math.min(h.maxHp, h.hp + regen * dt);
  }
}

function rankedThrowTargets(w: World): Monster[] {
  return w.monsters
    .filter(
      (m) =>
        m.hp > 0 &&
        Boolean(w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]) &&
        Math.hypot(m.x - w.hero.x, m.y - w.hero.y) <= w.heroDef.thrown.range,
    )
    .sort((a, b) => {
      const rank = (m: Monster) => (m.stats.throws && m.awake ? 0 : m.awake ? 100 : 200) + Math.hypot(m.x - w.hero.x, m.y - w.hero.y);
      return rank(a) - rank(b);
    });
}
export function throwTarget(w: World): Monster | undefined {
  return rankedThrowTargets(w)[0];
}

function bowRange(w: World): number {
  return w.weapon.range + effectValue(w, 'bow.range');
}
export function bowTargets(w: World): Monster[] {
  if (w.weapon.family !== 'bow') return [];
  const range = bowRange(w);
  return w.monsters
    .filter(
      (m) =>
        m.hp > 0 &&
        m.awake &&
        Boolean(w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]) &&
        Math.hypot(m.x - w.hero.x, m.y - w.hero.y) <= range,
    )
    .sort((a, b) => {
      const rank = (m: Monster) => (m.stats.throws ? 0 : 100) + Math.hypot(m.x - w.hero.x, m.y - w.hero.y);
      return rank(a) - rank(b);
    });
}
export function bowTarget(w: World): Monster | undefined {
  return bowTargets(w)[0];
}

function makeThrowShot(w: World, target: Monster): Shot {
  const h = w.hero,
    t = w.heroDef.thrown,
    dx = target.x - h.x,
    dy = target.y - h.y,
    d = Math.hypot(dx, dy) || 1;
  return {
    x: h.x,
    y: h.y,
    px: h.x,
    py: h.y,
    vx: (dx / d) * t.speed,
    vy: (dy / d) * t.speed,
    damage: t.damage + effectValue(w, 'throwing.power'),
    left: (t.range + 1.5) / t.speed,
    mine: true,
    pierce: Math.round(effectValue(w, 'throwing.pierce')),
    returns: hasEffect(w, 'throwing.return'),
    returning: false,
    hit: [],
  };
}
function throwNow(w: World): void {
  if (w.ammo <= 0) return;
  const targets = rankedThrowTargets(w);
  if (!targets.length) return;
  const desired = hasEffect(w, 'throwing.double') ? Math.round(effectValue(w, 'throwing.double')) : 1;
  const count = Math.min(desired, w.ammo, targets.length);
  for (const target of targets.slice(0, count)) w.shots.push(makeThrowShot(w, target));
  w.ammo -= count;
  w.pickupStats.throws += count;
  const first = targets[0]!,
    dx = first.x - w.hero.x;
  if (Math.abs(dx) > 0.15) w.hero.facing = dx < 0 ? -1 : 1;
  w.hero.throwing = throwCooldown(w);
  w.events.push({ type: 'throw', x: w.hero.x, y: w.hero.y });
}

function makeArrow(w: World, target: Monster): Shot {
  const h = w.hero,
    speed = w.weapon.projectileSpeed ?? 20,
    range = bowRange(w),
    dx = target.x - h.x,
    dy = target.y - h.y,
    d = Math.hypot(dx, dy) || 1;
  const pierce = w.weapon.effect === 'pierce_all' ? 999 : Math.round(effectValue(w, 'bow.pierce'));
  return {
    x: h.x,
    y: h.y,
    px: h.x,
    py: h.y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    damage: w.weapon.damage + weaponOption(w.weapon, 'damage') + effectValue(w, 'bow.damage'),
    left: (range + 0.25) / speed,
    mine: true,
    pierce,
    returns: false,
    returning: false,
    hit: [],
    arrow: true,
    brand: w.weapon.brand,
    weaponEffect: w.weapon.effect,
    stun: effectValue(w, 'bow.stun'),
  };
}
function bowCooldown(w: World): number {
  const skill = Math.max(-0.6, effectValue(w, 'bow.haste'));
  const randart = Math.min(0.5, weaponOption(w.weapon, 'haste'));
  return Math.max(0.18, w.weapon.every * (1 + skill) * (1 - randart));
}
function shootNow(w: World): void {
  const targets = bowTargets(w);
  if (!targets.length) return;
  const count = hasEffect(w, 'bow.double') ? 2 : 1;
  for (let i = 0; i < count; i++) w.shots.push(makeArrow(w, targets[Math.min(i, targets.length - 1)]!));
  const dx = targets[0]!.x - w.hero.x;
  if (Math.abs(dx) > 0.15) w.hero.facing = dx < 0 ? -1 : 1;
  w.hero.swing = bowCooldown(w);
}

function turnBack(w: World, s: Shot): void {
  s.returning = true;
  s.hit.length = 0;
  s.left = 10;
  const dx = w.hero.x - s.x,
    dy = w.hero.y - s.y,
    d = Math.hypot(dx, dy) || 1;
  s.vx = (dx / d) * w.heroDef.thrown.speed;
  s.vy = (dy / d) * w.heroDef.thrown.speed;
}
function finishThrow(w: World, s: Shot): boolean {
  if (s.mine && s.returns && !s.returning) {
    turnBack(w, s);
    return true;
  }
  if (s.mine && !s.returning) dropAmmo(w, s.px, s.py);
  return false;
}

function flyShots(w: World, dt: number): void {
  let kept = 0;
  for (const s of w.shots) {
    s.px = s.x;
    s.py = s.y;
    if (s.returning) {
      const dx = w.hero.x - s.x,
        dy = w.hero.y - s.y,
        d = Math.hypot(dx, dy) || 1;
      if (d <= w.heroDef.radius + 0.2) {
        w.ammo = Math.min(EQUIPMENT.ammoMax, w.ammo + 1);
        w.pickupStats.recovered++;
        continue;
      }
      s.vx = (dx / d) * w.heroDef.thrown.speed;
      s.vy = (dy / d) * w.heroDef.thrown.speed;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.left -= dt;
    const open = walkable(w.grid, Math.floor(s.x), Math.floor(s.y));
    if (s.left <= 0 || !open) {
      if (!s.arrow && finishThrow(w, s)) w.shots[kept++] = s;
      continue;
    }

    if (s.arrow) {
      const hit = w.monsters.find((m) => m.hp > 0 && !s.hit.includes(m) && Math.hypot(m.x - s.x, m.y - s.y) <= m.stats.radius + 0.18);
      if (hit) {
        s.hit.push(hit);
        strike(w, hit, s.damage, 0, 'arrow', s.vx, s.vy);
        applyBrand(w, hit, s.brand);
        if (hit.hp > 0 && (s.stun ?? 0) > 0) hit.stun = Math.max(hit.stun, s.stun ?? 0);
        noise(w, DUNGEON.arrowLoud);
        if (s.pierce > 0) {
          s.pierce--;
          w.shots[kept++] = s;
        }
        continue;
      }
      w.shots[kept++] = s;
      continue;
    }

    if (s.mine) {
      const hit = w.monsters.find((m) => m.hp > 0 && !s.hit.includes(m) && Math.hypot(m.x - s.x, m.y - s.y) <= m.stats.radius + 0.2);
      if (hit) {
        s.hit.push(hit);
        strike(w, hit, s.damage, w.heroDef.thrown.knock, 'throw', s.vx, s.vy);
        const slow = effectValue(w, 'throwing.slow');
        if (slow > 0) {
          hit.slow = Math.max(hit.slow, effectValue(w, 'throwing.slowTime'));
          hit.slowScale = Math.max(hit.slowScale, slow);
        }
        if (!s.returning && s.pierce > 0) s.pierce--;
        else if (!s.returning && !s.returns) {
          dropAmmo(w, s.x, s.y);
          continue;
        }
      }
    } else if (Math.hypot(s.x - w.hero.x, s.y - w.hero.y) <= w.heroDef.radius + 0.12) {
      hurtHero(w, s.damage, 'stone');
      continue;
    }
    w.shots[kept++] = s;
  }
  w.shots.length = kept;
}

export function heroStrikes(w: World, dt: number, wantsThrow: boolean): void {
  const h = w.hero;
  mend(w, dt);
  tickBrands(w, dt);
  flyShots(w, dt);
  if (w.over) return;
  h.swing -= dt;
  h.butt -= dt;
  if (h.throwing > 0) h.throwing -= dt;
  if (h.hopTime > 0) return;
  if (wantsThrow && h.throwing <= 0) throwNow(w);

  if (w.heroDef.attackMode === 'magic') {
    h.swing = Math.max(0, h.swing);
  } else if (w.weapon.family === 'bow') {
    if (h.swing <= 0) shootNow(w);
  } else if (h.swing <= 0) {
    const axeLevel = skillLevel(w, 'axe'),
      baseReach = w.weapon.range + (axeLevel >= 2 ? effectValue(w, 'axe.wide') : 0),
      next = h.axeSwings + 1;
    const spin = axeLevel >= 4 && next % 3 === 0 ? effectValue(w, 'axe.spin') : 1,
      reach = baseReach * spin;
    const damage = (w.weapon.damage + weaponOption(w.weapon, 'damage') + effectValue(w, 'axe.damage')) * spin;
    let any = false,
      kill = false,
      hits = 0;
    for (const m of w.monsters) {
      if (m.hp <= 0 || Math.hypot(m.x - h.x, m.y - h.y) - m.stats.radius > reach) continue;
      if (!any) w.events.push({ type: 'swing', x: h.x, y: h.y, reach: reach + 0.3 });
      any = true;
      hits++;
      kill = strike(w, m, Math.round(damage), w.weapon.knock, 'axe', m.x - h.x, m.y - h.y) || kill;
      if (m.hp > 0) applyWeaponBrand(w, m);
      if (m.hp > 0 && hasEffect(w, 'axe.stun')) m.stun = Math.max(m.stun, effectValue(w, 'axe.stun'));
    }
    if (any) {
      if (w.weapon.effect === 'glut' && hits >= 3) h.hp = Math.min(h.maxHp, h.hp + hits);
      h.axeSwings = next;
      const haste = Math.min(0.5, weaponOption(w.weapon, 'haste'));
      h.swing = kill && hasEffect(w, 'axe.reset') ? 0 : w.weapon.every * (1 - haste);
      noise(w, DUNGEON.loud);
    } else h.swing = 0;
  }

  const horns = hornTrait(w);
  if (horns && h.butt <= 0) {
    let nearest: Monster | undefined,
      best = Infinity;
    for (const m of w.monsters) {
      if (m.hp <= 0) continue;
      const d = Math.hypot(m.x - h.x, m.y - h.y) - m.stats.radius;
      if (d <= horns.reach && d < best) {
        best = d;
        nearest = m;
      }
    }
    if (nearest) {
      strike(w, nearest, hornDamage(w), horns.knock, 'horns', nearest.x - h.x, nearest.y - h.y);
      nearest.stun = horns.stun;
      nearest.wind = -1;
      h.butt = hornEvery(w);
    } else h.butt = 0;
  }
  let kept = 0;
  for (const m of w.monsters) if (m.hp > 0) w.monsters[kept++] = m;
  w.monsters.length = kept;
}
