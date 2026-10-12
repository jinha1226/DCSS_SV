import { spellData, type SpellData, type SpellHit } from '../data/spells';
import { hurtMonster } from './hits';
import type { Hero, Monster, World } from './types';

/** Poison and rot deal their damage in steps this long, so numbers stay readable. */
const AFFLICTION_STEP = 0.5;
const DEFAULT_DURATION = 2;

export interface HitOrigin {
  readonly x: number;
  readonly y: number;
}

function push(m: Monster, from: HitOrigin, speed: number): void {
  const dx = m.x - from.x;
  const dy = m.y - from.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-4) return;
  m.kx = (dx / d) * speed;
  m.ky = (dy / d) * speed;
}

function afflictMonster(w: World, m: Monster, hit: SpellHit, dealt: number, from: HitOrigin): void {
  const power = hit.power ?? 0;
  const duration = hit.duration ?? DEFAULT_DURATION;
  switch (hit.effect) {
    case 'slow':
      m.slow = Math.max(m.slow, duration);
      m.slowScale = Math.max(m.slowScale, Math.min(0.9, power));
      return;
    case 'stun':
      m.stun = Math.max(m.stun, duration);
      return;
    case 'confuse':
      m.confusion = Math.max(m.confusion, duration);
      return;
    case 'vulnerable':
      m.vulnerable = Math.max(m.vulnerable, duration);
      m.vulnerableScale = Math.max(m.vulnerableScale, power);
      return;
    case 'rot':
      m.rot = Math.max(m.rot, duration);
      m.rotArmour = Math.max(m.rotArmour, power);
      m.rotDamage = Math.max(m.rotDamage, hit.damage ?? 0);
      return;
    case 'poison':
      m.poison = Math.max(m.poison, duration);
      m.poisonDamage = Math.max(m.poisonDamage, power);
      return;
    case 'burn':
      m.burning = Math.max(m.burning, duration);
      m.burnDamage = Math.max(m.burnDamage, power);
      return;
    case 'knockback':
      push(m, from, power);
      return;
    case 'pull':
      push(m, from, -power);
      return;
    case 'drain':
      w.hero.hp = Math.min(w.hero.maxHp, w.hero.hp + dealt * power);
      return;
  }
}

/**
 * Rider effects of a spell that just hit. Monster casters only poison the hero:
 * the other riders are hero tools and must not change how hard monsters are.
 */
export function applySpellHit(w: World, spellId: string | undefined, target: Monster | Hero, dealt: number, from: HitOrigin): void {
  if (!spellId) return;
  const hit = spellData(spellId).onHit;
  if (!hit) return;
  if (target === w.hero) {
    if (hit.effect === 'poison') w.hero.poison = Math.max(w.hero.poison, hit.duration ?? DEFAULT_DURATION);
    return;
  }
  const m = target as Monster;
  if (m.hp <= 0 && hit.effect !== 'drain') return;
  afflictMonster(w, m, hit, dealt, from);
}

/** Buff spells: armour or speed on the hero for a while. */
export function applyBuff(w: World, spell: SpellData): boolean {
  const h = w.hero;
  const duration = spell.duration ?? DEFAULT_DURATION;
  const power = spell.power ?? 0;
  if (spell.effect === 'armour') {
    h.armourBuff = Math.max(h.armourBuff, duration);
    h.armourBuffPower = Math.max(h.armourBuffPower, power);
    return true;
  }
  if (spell.effect === 'speed') {
    h.speedBuff = Math.max(h.speedBuff, duration);
    h.speedBuffPower = Math.max(h.speedBuffPower, power);
    return true;
  }
  return false;
}

const DEBUFF_HITS: Readonly<Record<string, SpellHit['effect']>> = { freeze: 'stun', confuse: 'confuse', rot: 'rot' };

/** Debuff spells: an affliction (and optional damage) on every enemy near the chosen target. */
export function castDebuff(w: World, spell: SpellData, target: Monster, damage: number): void {
  const effect = DEBUFF_HITS[spell.effect ?? ''];
  if (!effect) return;
  // Rot turns the spell's base damage into damage per second (unscaled until balancing); the others hit once.
  const rot = effect === 'rot';
  const hit: SpellHit = {
    effect,
    power: spell.power ?? 0,
    duration: spell.duration ?? DEFAULT_DURATION,
    ...(rot ? { damage: spell.damage ?? 0 } : {}),
  };
  const radius = spell.radius ?? 0;
  for (const m of w.monsters) {
    if (m.hp <= 0 || Math.hypot(m.x - target.x, m.y - target.y) > radius + m.stats.radius) continue;
    const dealt = damage > 0 && !rot ? hurtMonster(w, m, damage, spell.element ?? 'physical', 'spell').damage : 0;
    if (m.hp > 0) afflictMonster(w, m, hit, dealt, target);
  }
  w.spellVisuals.push({
    shape: 'burst',
    x1: target.x,
    y1: target.y,
    x2: target.x,
    y2: target.y,
    radius: Math.max(radius, 0.6),
    colour: spell.colour,
    left: 0.18,
  });
}

function tickMonsterAfflictions(w: World, m: Monster, dt: number): void {
  if (m.vulnerable > 0 && (m.vulnerable -= dt) <= 0) m.vulnerableScale = 0;
  const poisoned = m.poison > 0;
  const rotting = m.rot > 0;
  if (poisoned) m.poison -= dt;
  if (rotting) m.rot -= dt;
  if (m.poison <= 0) m.poisonDamage = 0;
  if (m.rot <= 0) {
    m.rotArmour = 0;
    m.rotDamage = 0;
  }
  if (!poisoned && !rotting) return;
  m.afflictionTick -= dt;
  if (m.afflictionTick > 0) return;
  m.afflictionTick += AFFLICTION_STEP;
  if (poisoned && m.poisonDamage > 0) hurtMonster(w, m, m.poisonDamage * AFFLICTION_STEP, 'poison', 'spell');
  if (rotting && m.rotDamage > 0 && m.hp > 0) hurtMonster(w, m, m.rotDamage * AFFLICTION_STEP, 'negative', 'spell');
}

export function tickSpellEffects(w: World, dt: number): void {
  const h = w.hero;
  if (h.armourBuff > 0 && (h.armourBuff -= dt) <= 0) h.armourBuffPower = 0;
  if (h.speedBuff > 0 && (h.speedBuff -= dt) <= 0) h.speedBuffPower = 0;
  for (const m of w.monsters) if (m.hp > 0) tickMonsterAfflictions(w, m, dt);
}
