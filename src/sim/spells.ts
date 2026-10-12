import { monsterSpellMana, selfSpell, spellData, type SpellData } from '../data/spells';
import { applyBuff, castDebuff, tickSpellEffects } from './spellEffects';
import { executeSpell, tickClouds, tickProjectiles, tickVisuals, visibleMonster, type SpellActor, type SpellCaster } from './spellCast';
import { castShape, castUntargeted, tickShapes, untargetedShape } from './spellShapes';
import { walkable } from './grid';
import { computeFov } from './fov';
import { updateFlow } from './flow';
import { skillLevel } from './skills';
import { basicSpell, paidSpells, requiredLevel, slottedSpell, spellCooldownLeft, tickSpellCooldowns } from './spellAccess';
import type { Monster, World } from './types';

export {
  basicSpell,
  knownSpells,
  lockedSpells,
  paidSpells,
  requiredLevel,
  setSpellSlot,
  spellReady,
  spellSlots,
  SPELL_SLOTS,
} from './spellAccess';

/** Global pause between two button casts so a double tap does not fire twice. */
const BUTTON_GAP = 0.25;

function spellExcess(w: World, spell: SpellData): number {
  return Math.max(0, skillLevel(w, spell.school) - requiredLevel(spell));
}

/** Skill adds a little reach, never more than this many cells, so cones and bolts stay on screen. */
const MAX_RANGE_BONUS = 3;

export function spellRange(w: World, spell: SpellData): number {
  return (spell.range ?? 0) + Math.min(MAX_RANGE_BONUS, Math.floor(spellExcess(w, spell) / 2));
}

/** Skill above the requirement adds damage, but pure control spells (no base damage) stay harmless. */
export function spellDamage(w: World, spell: SpellData): number {
  if (!spell.damage) return 0;
  return spell.damage + spellExcess(w, spell) * 2;
}

export function spellCandidates(w: World, spell: SpellData): Monster[] {
  const range = spellRange(w, spell);
  return w.monsters
    .filter((m) => m.hp > 0 && m.awake && visibleMonster(w, m) && Math.hypot(m.x - w.hero.x, m.y - w.hero.y) <= range)
    .sort((a, b) => {
      const priority = (m: Monster): number => (m.stats.throws ? 0 : 100) + Math.hypot(m.x - w.hero.x, m.y - w.hero.y);
      return priority(a) - priority(b);
    });
}

export function spellTarget(w: World, spell: SpellData): Monster | undefined {
  return spellCandidates(w, spell)[0];
}

function refreshHeroSight(w: World): void {
  computeFov(w.grid, Math.floor(w.hero.x), Math.floor(w.hero.y), w.heroDef.sight, w.visible);
  for (let i = 0; i < w.visible.length; i++) if (w.visible[i]) w.seen[i] = 1;
  updateFlow(w.flow, w.grid, Math.floor(w.hero.x), Math.floor(w.hero.y));
}

/** Shared utility effects with side-specific ownership (not separate spell data). */
function applyUtilitySpell(w: World, spell: SpellData, caster: SpellCaster, actor: SpellActor): boolean {
  if (spell.effect === 'guard') {
    if (caster === 'hero') w.hero.invulnerable = Math.max(w.hero.invulnerable, spell.duration ?? 2);
    else (actor as Monster).guard = Math.max((actor as Monster).guard, spell.duration ?? 2);
    return true;
  }
  if (spell.effect !== 'blink') return false;
  const monster = caster === 'monster' ? (actor as Monster) : undefined;
  const fromHeroX = actor.x - w.hero.x;
  const fromHeroY = actor.y - w.hero.y;
  const d = Math.hypot(fromHeroX, fromHeroY) || 1;
  const ux = monster ? fromHeroX / d : w.hero.facing;
  const uy = monster ? fromHeroY / d : 0;
  for (let step = spell.distance ?? 3; step >= 1; step--) {
    const x = actor.x + ux * step;
    const y = actor.y + uy * step;
    if (!walkable(w.grid, Math.floor(x), Math.floor(y))) continue;
    if (monster) {
      if (Math.hypot(w.hero.x - x, w.hero.y - y) < monster.stats.radius + w.heroDef.radius) continue;
      if (
        w.monsters.some(
          (other) => other !== monster && other.hp > 0 && Math.hypot(other.x - x, other.y - y) < other.stats.radius + monster.stats.radius,
        )
      )
        continue;
    }
    actor.x = actor.px = x;
    actor.y = actor.py = y;
    if (caster === 'hero') refreshHeroSight(w);
    return true;
  }
  return false;
}

function execute(w: World, spell: SpellData, target: Monster): void {
  const multiplier = w.weapon.kind && basicSpell(w)?.id === spell.id ? (w.weapon.power ?? 1) : 1;
  const damage = spellDamage(w, spell) * multiplier;
  const range = spellRange(w, spell);
  if (spell.shape === 'debuff') castDebuff(w, spell, target, damage);
  else if (!castShape(w, spell, target, damage, range)) executeSpell(w, spell, 'hero', w.hero, target, damage, range);
  const dx = target.x - w.hero.x;
  if (Math.abs(dx) > 0.15) w.hero.facing = dx < 0 ? -1 : 1;
}

/**
 * Monster uses the player's spells.json and shared shape/effect dispatcher.
 * Resources and ownership live on the caster, not on duplicate spell records.
 */
export function castMonsterSpell(w: World, monster: Monster, spellId: string): boolean {
  const spell = spellData(spellId);
  if (!spell.enabled || monster.mana < monsterSpellMana(spell) || monster.spellCooldown > 0) return false;
  if (spell.shape === 'utility') {
    if (!applyUtilitySpell(w, spell, 'monster', monster)) return false;
  } else {
    if (!['projectile', 'beam', 'burst', 'cloud'].includes(spell.shape) || spell.damage === undefined || spell.range === undefined)
      return false;
    const d = Math.hypot(w.hero.x - monster.x, w.hero.y - monster.y);
    if (d > spell.range || !w.visible[Math.floor(monster.y) * w.grid.w + Math.floor(monster.x)]) return false;
    executeSpell(w, spell, 'monster', monster, w.hero, spell.damage, spell.range);
  }
  monster.mana -= monsterSpellMana(spell);
  monster.spellCooldown = Math.max(0.25, 0.45 - spell.level * 0.02);
  return true;
}

export function castPaidSpell(w: World, spellId: string, target?: Monster): boolean {
  const spell = spellData(spellId);
  if (!paidSpells(w).some((entry) => entry.id === spell.id) || !slottedSpell(w, spell.id)) return false;
  if (w.hero.mana < spell.mana || spellCooldownLeft(w, spell.id) > 0) return false;
  if (spell.shape === 'utility') {
    if (!applyUtilitySpell(w, spell, 'hero', w.hero)) return false;
  } else if (spell.shape === 'buff') {
    if (!applyBuff(w, spell)) return false;
  } else if (untargetedShape(spell)) {
    castUntargeted(w, spell, spellDamage(w, spell));
  } else {
    const chosen = target ?? spellTarget(w, spell);
    if (!chosen || !spellCandidates(w, spell).includes(chosen)) return false;
    execute(w, spell, chosen);
  }
  w.hero.mana -= spell.mana;
  w.hero.spellCooldown = Math.max(w.hero.spellCooldown, BUTTON_GAP);
  w.hero.spellCooldowns[spell.id] = spell.cooldown ?? 0;
  return true;
}

function autoBasic(w: World): void {
  const spell = basicSpell(w);
  if (!spell || w.hero.autoCooldown > 0) return;
  const target = spellTarget(w, spell);
  if (!target) return;
  execute(w, spell, target);
  w.hero.autoCooldown = Math.max(0.35, 0.78 - spell.level * 0.04);
}

function pruneDead(w: World): void {
  let kept = 0;
  for (const m of w.monsters) if (m.hp > 0) w.monsters[kept++] = m;
  w.monsters.length = kept;
}

export function stepSpells(w: World, dt: number): void {
  const h = w.hero;
  h.mana = Math.min(h.maxMana, h.mana + w.heroDef.manaRegen * dt);
  tickSpellCooldowns(w, dt);
  tickSpellEffects(w, dt);
  tickProjectiles(w, dt);
  tickClouds(w, dt);
  tickShapes(w, dt);
  tickVisuals(w, dt);
  if ((w.weapon.kind === 'staff' || w.weapon.kind === 'rod') && h.hopTime <= 0) autoBasic(w);
  pruneDead(w);
}

export function spellAtPoint(w: World, spell: SpellData, x: number, y: number): Monster | undefined {
  return spellCandidates(w, spell)
    .map((m) => ({ m, d: Math.hypot(m.x - x, m.y - y) }))
    .filter((entry) => entry.d <= entry.m.stats.radius + 0.55)
    .sort((a, b) => a.d - b.d)[0]?.m;
}

export function castAt(w: World, spellId: string, x: number, y: number): boolean {
  const spell = spellData(spellId);
  if (selfSpell(spell) || untargetedShape(spell)) return castPaidSpell(w, spellId);
  const target = spellAtPoint(w, spell, x, y);
  return target ? castPaidSpell(w, spellId, target) : false;
}
