import type { ResistName } from '../data/items';
import { spellData, type SpellData } from '../data/spells';
import { hurtHero } from './effects';
import { walkable } from './grid';
import { hurtMonster } from './hits';
import { applySpellHit, type HitOrigin } from './spellEffects';
import type { Hero, Monster, SpellCloud, SpellShot, SpellVisual, World } from './types';

export const VISUAL_TIME = 0.18;

export type SpellCaster = 'hero' | 'monster';
export type SpellActor = Hero | Monster;

export interface SpellHitInfo {
  readonly spellId?: string;
  /** Where the hit comes from: knockback pushes away from it, pull draws towards it. */
  readonly from: HitOrigin;
}

/** Trail flames and zaps deal this share of the shot's damage. */
const TRAIL_SHARE = 0.25;
const ZAP_SHARE = 0.4;
const TRAIL_EVERY = 0.08;
const ZAP_EVERY = 0.3;

export function visibleMonster(w: World, m: Monster): boolean {
  return Boolean(w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]);
}

/** Both allegiances resolve spell hits through the same target defence rules, then the spell's rider. */
export function hitSpellTarget(
  w: World,
  caster: SpellCaster,
  target: SpellActor,
  damage: number,
  element: ResistName | undefined,
  sourceMonster: Monster | undefined,
  info: SpellHitInfo,
): void {
  let dealt = 0;
  if (caster === 'hero') {
    if (damage > 0) dealt = hurtMonster(w, target as Monster, damage, element ?? 'physical', 'spell').damage;
  } else if (!hurtHero(w, element ? 0 : damage, 'spell', sourceMonster, element ? { type: element, damage } : undefined)) {
    return;
  }
  applySpellHit(w, info.spellId, target, dealt, info.from);
}

export function enemiesOf(w: World, caster: SpellCaster): readonly SpellActor[] {
  return caster === 'hero' ? w.monsters : [w.hero];
}

export function bodyRadius(w: World, caster: SpellCaster, enemy: SpellActor): number {
  return caster === 'hero' ? (enemy as Monster).stats.radius : w.heroDef.radius;
}

export function pushVisual(w: World, spell: SpellData, visual: Omit<SpellVisual, 'colour' | 'spellId' | 'left'>, left = VISUAL_TIME): void {
  w.spellVisuals.push({ ...visual, colour: spell.colour, spellId: spell.id, left, total: left });
}

export function rayEnd(
  w: World,
  from: { x: number; y: number },
  target: { x: number; y: number },
  range: number,
): { x: number; y: number } {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  let x = from.x;
  let y = from.y;
  const steps = Math.ceil(range * 10);
  for (let i = 0; i < steps; i++) {
    const nx = x + ux * 0.1;
    const ny = y + uy * 0.1;
    if (!walkable(w.grid, Math.floor(nx), Math.floor(ny))) break;
    x = nx;
    y = ny;
  }
  return { x, y };
}

function castProjectile(
  w: World,
  spell: SpellData,
  caster: SpellCaster,
  from: SpellActor,
  target: SpellActor,
  damage: number,
  range: number,
): void {
  const speed = spell.speed ?? 16;
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const shot: SpellShot = {
    x: from.x,
    y: from.y,
    px: from.x,
    py: from.y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    left: ((spell.homing ? 1.6 : 1) * (range + 0.5)) / speed,
    damage,
    pierce: spell.pierce ?? 0,
    colour: spell.colour,
    element: spell.element,
    hit: [],
    caster,
    spellId: spell.id,
    ...(caster === 'monster' ? { sourceMonster: from as Monster } : {}),
    ...(spell.homing && caster === 'hero' ? { homingTarget: target as Monster } : {}),
  };
  w.spellShots.push(shot);
}

function castBeam(
  w: World,
  spell: SpellData,
  caster: SpellCaster,
  from: SpellActor,
  target: SpellActor,
  damage: number,
  range: number,
): void {
  const end = rayEnd(w, from, target, range);
  const dx = end.x - from.x;
  const dy = end.y - from.y;
  const length2 = dx * dx + dy * dy || 1;
  for (const enemy of enemiesOf(w, caster)) {
    if (enemy.hp <= 0) continue;
    const t = Math.max(0, Math.min(1, ((enemy.x - from.x) * dx + (enemy.y - from.y) * dy) / length2));
    if (Math.hypot(enemy.x - (from.x + dx * t), enemy.y - (from.y + dy * t)) <= bodyRadius(w, caster, enemy) + 0.18) {
      hitSpellTarget(w, caster, enemy, damage, spell.element, caster === 'monster' ? (from as Monster) : undefined, {
        spellId: spell.id,
        from,
      });
    }
  }
  pushVisual(w, spell, { shape: 'beam', x1: from.x, y1: from.y, x2: end.x, y2: end.y, radius: 0 });
}

/** A burst at a point: every enemy within the radius is hit. */
export function burstAt(
  w: World,
  spell: SpellData,
  caster: SpellCaster,
  at: { x: number; y: number },
  radius: number,
  damage: number,
  sourceMonster?: Monster,
): Monster[] {
  const caught: Monster[] = [];
  for (const enemy of enemiesOf(w, caster)) {
    if (enemy.hp <= 0) continue;
    if (Math.hypot(enemy.x - at.x, enemy.y - at.y) <= radius + bodyRadius(w, caster, enemy)) {
      if (caster === 'hero') caught.push(enemy as Monster);
      hitSpellTarget(w, caster, enemy, damage, spell.element, sourceMonster, { spellId: spell.id, from: { x: at.x, y: at.y } });
    }
  }
  pushVisual(w, spell, { shape: 'burst', x1: at.x, y1: at.y, x2: at.x, y2: at.y, radius }, VISUAL_TIME * 1.6);
  return caught;
}

export function castCloudAt(
  w: World,
  spell: SpellData,
  caster: SpellCaster,
  at: { x: number; y: number },
  damage: number,
  options: { readonly radius?: number; readonly duration?: number; readonly tick?: number; readonly sourceMonster?: Monster } = {},
): void {
  const cloud: SpellCloud = {
    x: at.x,
    y: at.y,
    radius: options.radius ?? spell.radius ?? 1,
    damage,
    left: options.duration ?? spell.duration ?? 2,
    tick: options.tick ?? spell.tick ?? 0.5,
    nextTick: 0,
    colour: spell.colour,
    element: spell.element,
    caster,
    spellId: spell.id,
    ...(options.sourceMonster ? { sourceMonster: options.sourceMonster } : {}),
  };
  w.spellClouds.push(cloud);
}

/** Shared shape dispatcher for the basic shapes: no separate monster spell effect implementations. */
export function executeSpell(
  w: World,
  spell: SpellData,
  caster: SpellCaster,
  from: SpellActor,
  target: SpellActor,
  damage: number,
  range: number,
): void {
  const source = caster === 'monster' ? (from as Monster) : undefined;
  if (spell.shape === 'projectile') castProjectile(w, spell, caster, from, target, damage, range);
  else if (spell.shape === 'beam') castBeam(w, spell, caster, from, target, damage, range);
  else if (spell.shape === 'burst') burstAt(w, spell, caster, target, spell.radius ?? 1, damage, source);
  else if (spell.shape === 'cloud') castCloudAt(w, spell, caster, target, damage, source ? { sourceMonster: source } : {});
}

/** A projectile pushes along its flight, as if from a point just behind it. */
function shotHit(shot: SpellShot): SpellHitInfo {
  return { spellId: shot.spellId, from: { x: shot.x - shot.vx, y: shot.y - shot.vy } };
}

function steer(shot: SpellShot, spell: SpellData, dt: number): void {
  const target = shot.homingTarget;
  if (!target || target.hp <= 0 || !spell.homing) return;
  const speed = Math.hypot(shot.vx, shot.vy);
  const want = Math.atan2(target.y - shot.y, target.x - shot.x);
  const now = Math.atan2(shot.vy, shot.vx);
  let turn = want - now;
  while (turn > Math.PI) turn -= Math.PI * 2;
  while (turn < -Math.PI) turn += Math.PI * 2;
  const step = Math.max(-spell.homing * dt, Math.min(spell.homing * dt, turn));
  shot.vx = Math.cos(now + step) * speed;
  shot.vy = Math.sin(now + step) * speed;
}

/** Ball lightning zaps the nearest monster near its path; a lava lance drops short flames behind it. */
function shotExtras(w: World, shot: SpellShot, spell: SpellData, dt: number): void {
  if (spell.zapRadius) {
    shot.zapTimer = (shot.zapTimer ?? 0) - dt;
    if (shot.zapTimer <= 0) {
      shot.zapTimer = ZAP_EVERY;
      const near = w.monsters
        .filter((m) => m.hp > 0 && Math.hypot(m.x - shot.x, m.y - shot.y) <= spell.zapRadius! + m.stats.radius)
        .sort((a, b) => Math.hypot(a.x - shot.x, a.y - shot.y) - Math.hypot(b.x - shot.x, b.y - shot.y))[0];
      if (near) {
        hitSpellTarget(w, 'hero', near, shot.damage * ZAP_SHARE, spell.element, undefined, shotHit(shot));
        pushVisual(w, spell, { shape: 'chain', x1: shot.x, y1: shot.y, x2: near.x, y2: near.y, radius: 0, points: [shot, near] });
      }
    }
  }
  if (spell.trail) {
    shot.trailTimer = (shot.trailTimer ?? 0) - dt;
    if (shot.trailTimer <= 0) {
      shot.trailTimer = TRAIL_EVERY;
      castCloudAt(w, spell, 'hero', shot, shot.damage * TRAIL_SHARE, { radius: 0.4, duration: 1.2, tick: 0.4 });
    }
  }
}

function impact(w: World, shot: SpellShot, spell: SpellData | undefined): void {
  if (!spell?.impactRadius || shot.caster === 'monster') return;
  burstAt(w, spell, 'hero', shot, spell.impactRadius, shot.damage * 0.6);
}

export function tickProjectiles(w: World, dt: number): void {
  let kept = 0;
  for (const shot of w.spellShots) {
    const spell = shot.spellId ? spellData(shot.spellId) : undefined;
    if (spell && shot.caster !== 'monster') {
      steer(shot, spell, dt);
      shotExtras(w, shot, spell, dt);
    }
    shot.px = shot.x;
    shot.py = shot.y;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.left -= dt;
    if (!walkable(w.grid, Math.floor(shot.x), Math.floor(shot.y))) {
      impact(w, { ...shot, x: shot.px, y: shot.py }, spell);
      continue;
    }
    if (shot.left <= 0) continue;
    if (shot.caster === 'monster') {
      if (!shot.hitHero && Math.hypot(w.hero.x - shot.x, w.hero.y - shot.y) <= w.heroDef.radius + 0.16) {
        shot.hitHero = true;
        hitSpellTarget(w, 'monster', w.hero, shot.damage, shot.element, shot.sourceMonster, shotHit(shot));
        if (shot.pierce > 0) shot.pierce--;
        else continue;
      }
    } else {
      const hit = w.monsters.find(
        (m) => m.hp > 0 && !shot.hit.includes(m) && Math.hypot(m.x - shot.x, m.y - shot.y) <= m.stats.radius + 0.16,
      );
      if (hit) {
        shot.hit.push(hit);
        hitSpellTarget(w, 'hero', hit, shot.damage, shot.element, undefined, shotHit(shot));
        if (shot.pierce > 0) shot.pierce--;
        else {
          impact(w, shot, spell);
          continue;
        }
      }
    }
    w.spellShots[kept++] = shot;
  }
  w.spellShots.length = kept;
}

export function tickClouds(w: World, dt: number): void {
  let kept = 0;
  for (const cloud of w.spellClouds) {
    cloud.left -= dt;
    cloud.nextTick -= dt;
    if (cloud.nextTick <= 0) {
      cloud.nextTick += cloud.tick;
      const owner = cloud.caster ?? 'hero';
      for (const target of enemiesOf(w, owner)) {
        if (target.hp <= 0) continue;
        if (Math.hypot(target.x - cloud.x, target.y - cloud.y) <= cloud.radius + bodyRadius(w, owner, target)) {
          hitSpellTarget(w, owner, target, cloud.damage, cloud.element, cloud.sourceMonster, { spellId: cloud.spellId, from: cloud });
        }
      }
    }
    if (cloud.left > 0) w.spellClouds[kept++] = cloud;
  }
  w.spellClouds.length = kept;
}

export function tickVisuals(w: World, dt: number): void {
  let kept = 0;
  for (const visual of w.spellVisuals) {
    visual.left -= dt;
    if (visual.left > 0) w.spellVisuals[kept++] = visual;
  }
  w.spellVisuals.length = kept;
}
