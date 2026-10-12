import { spellData, type SpellData } from '../data/spells';
import { burstAt, hitSpellTarget, pushVisual, visibleMonster, VISUAL_TIME } from './spellCast';
import type { Monster, SpellOngoing, World } from './types';

/** Whole-sight fields and storms only touch monsters the hero can see. */
function seenEnemies(w: World): Monster[] {
  return w.monsters.filter((m) => m.hp > 0 && visibleMonster(w, m));
}

/** Cone: everything within range and the half-angle of the line towards the target. */
function castCone(w: World, spell: SpellData, target: Monster, damage: number, range: number): void {
  const h = w.hero;
  const facing = Math.atan2(target.y - h.y, target.x - h.x);
  const spread = ((spell.angle ?? 60) * Math.PI) / 360;
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    const d = Math.hypot(m.x - h.x, m.y - h.y);
    if (d > range + m.stats.radius) continue;
    let off = Math.atan2(m.y - h.y, m.x - h.x) - facing;
    while (off > Math.PI) off -= Math.PI * 2;
    while (off < -Math.PI) off += Math.PI * 2;
    if (Math.abs(off) <= spread || d < m.stats.radius + 0.4) {
      hitSpellTarget(w, 'hero', m, damage, spell.element, undefined, { spellId: spell.id, from: h });
    }
  }
  pushVisual(
    w,
    spell,
    { shape: 'cone', x1: h.x, y1: h.y, x2: target.x, y2: target.y, radius: range, angle: facing, spread },
    VISUAL_TIME * 1.6,
  );
}

/** Chain: hit the target, then jump to the nearest monster not yet hit, up to `targets` times. */
function castChain(w: World, spell: SpellData, target: Monster, damage: number): void {
  const hit: Monster[] = [];
  const points: { x: number; y: number }[] = [{ x: w.hero.x, y: w.hero.y }];
  let current: Monster | undefined = target;
  const reach = spell.chainRadius ?? 3;
  while (current && hit.length < (spell.targets ?? 3)) {
    hit.push(current);
    points.push({ x: current.x, y: current.y });
    hitSpellTarget(w, 'hero', current, damage, spell.element, undefined, { spellId: spell.id, from: points[points.length - 2]! });
    const from: Monster = current;
    current = w.monsters
      .filter((m) => m.hp > 0 && !hit.includes(m) && visibleMonster(w, m) && Math.hypot(m.x - from.x, m.y - from.y) <= reach)
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
  }
  pushVisual(w, spell, { shape: 'chain', x1: w.hero.x, y1: w.hero.y, x2: target.x, y2: target.y, radius: 0, points }, VISUAL_TIME * 1.4);
}

/** Mark: the target carries the spell until it dies or the mark wears off. */
function castMark(w: World, spell: SpellData, target: Monster, damage: number): void {
  target.mark = { spellId: spell.id, left: spell.duration ?? 6, damage };
  pushVisual(w, spell, { shape: 'mark', x1: target.x, y1: target.y, x2: target.x, y2: target.y, radius: 0.5 });
}

function startOngoing(w: World, spell: SpellData, kind: SpellOngoing['kind'], at: { x: number; y: number }, damage: number): void {
  const total = spell.duration ?? 2;
  w.spellOngoing.push({
    kind,
    spellId: spell.id,
    x: at.x,
    y: at.y,
    radius: spell.radius ?? 1,
    damage,
    total,
    left: total,
    tick: spell.tick ?? 0.5,
    nextTick: kind === 'delayed' ? total : 0,
  });
}

/** The new shapes. Returns false for shapes this module does not handle. */
export function castShape(w: World, spell: SpellData, target: Monster, damage: number, range: number): boolean {
  switch (spell.shape) {
    case 'cone':
      castCone(w, spell, target, damage, range);
      return true;
    case 'chain':
      castChain(w, spell, target, damage);
      return true;
    case 'mark':
      castMark(w, spell, target, damage);
      return true;
    case 'delayed':
      startOngoing(w, spell, 'delayed', target, damage);
      return true;
    default:
      return false;
  }
}

/** Shapes that need no target: auras, storms and fields centre on the hero. */
export function untargetedShape(spell: SpellData): boolean {
  return spell.shape === 'aura' || spell.shape === 'field' || spell.shape === 'storm';
}

export function castUntargeted(w: World, spell: SpellData, damage: number): void {
  if (untargetedShape(spell)) startOngoing(w, spell, spell.shape as SpellOngoing['kind'], w.hero, damage);
}

function pulse(w: World, effect: SpellOngoing, spell: SpellData): void {
  if (effect.kind === 'aura') {
    for (const m of w.monsters) {
      if (m.hp > 0 && Math.hypot(m.x - effect.x, m.y - effect.y) <= effect.radius + m.stats.radius) {
        hitSpellTarget(w, 'hero', m, effect.damage, spell.element, undefined, { spellId: spell.id, from: effect });
      }
    }
  } else if (effect.kind === 'field') {
    pushVisual(w, spell, { shape: 'field', x1: effect.x, y1: effect.y, x2: effect.x, y2: effect.y, radius: w.heroDef.sight });
    for (const m of seenEnemies(w))
      hitSpellTarget(w, 'hero', m, effect.damage, spell.element, undefined, { spellId: spell.id, from: effect });
  } else if (effect.kind === 'storm') {
    // Prefer landing on monsters in range; otherwise strike open ground nearby.
    const near = seenEnemies(w).filter((m) => Math.hypot(m.x - effect.x, m.y - effect.y) <= (spell.range ?? 6));
    const pick = near[Math.floor(w.rng() * near.length)];
    const angle = w.rng() * Math.PI * 2;
    const at = pick
      ? { x: pick.x + (w.rng() - 0.5) * 0.8, y: pick.y + (w.rng() - 0.5) * 0.8 }
      : { x: effect.x + Math.cos(angle) * 2.5, y: effect.y + Math.sin(angle) * 2.5 };
    burstAt(w, spell, 'hero', at, effect.radius, effect.damage);
  } else {
    burstAt(w, spell, 'hero', effect, effect.radius, effect.damage);
  }
}

/** Marks that went off: a fire brand explodes and spreads; a death mark feeds the hero. */
function resolveMarks(w: World): void {
  while (w.markQueue.length) {
    const fired = w.markQueue.shift()!;
    const spell = spellData(fired.spellId);
    if (spell.effect === 'harvest') {
      const h = w.hero;
      h.hp = Math.min(h.maxHp, h.hp + (spell.power ?? 5));
      h.mana = Math.min(h.maxMana, h.mana + (spell.power ?? 5) / 2);
      pushVisual(w, spell, { shape: 'mark', x1: fired.x, y1: fired.y, x2: h.x, y2: h.y, radius: 0.5 }, VISUAL_TIME * 2);
      continue;
    }
    const caught = burstAt(w, spell, 'hero', fired, spell.radius ?? 1.4, fired.damage);
    for (const m of caught) if (m.hp > 0 && !m.mark) m.mark = { spellId: spell.id, left: spell.duration ?? 6, damage: fired.damage };
  }
}

export function tickShapes(w: World, dt: number): void {
  for (const m of w.monsters) if (m.mark && (m.mark.left -= dt) <= 0) m.mark = undefined;
  resolveMarks(w);
  let kept = 0;
  for (const effect of w.spellOngoing) {
    const spell = spellData(effect.spellId);
    if (effect.kind === 'aura' || effect.kind === 'field' || effect.kind === 'storm') {
      effect.x = w.hero.x;
      effect.y = w.hero.y;
    }
    effect.left -= dt;
    effect.nextTick -= dt;
    if (effect.nextTick <= 0) {
      effect.nextTick += effect.kind === 'delayed' ? Infinity : effect.tick;
      pulse(w, effect, spell);
    }
    // A zero-length field (earthquake) still pulses once before it ends.
    if (effect.left > 0 && effect.nextTick !== Infinity) w.spellOngoing[kept++] = effect;
  }
  w.spellOngoing.length = kept;
}
