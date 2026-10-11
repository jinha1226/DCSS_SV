import { ACTIVE_SPELL_SHAPES, SPELLS, SPELL_SCHOOLS, spellData, type SpellData } from '../data/spells';
import { walkable } from './grid';
import { computeFov } from './fov';
import { updateFlow } from './flow';
import type { ResistName } from '../data/items';
import { skillLevel } from './skills';
import { hurtHero } from './effects';
import { hurtMonster } from './hits';
import type { Hero, Monster, SpellCloud, SpellShot, World } from './types';

const VISUAL_TIME = 0.18;

function visible(w: World, m: Monster): boolean {
  return Boolean(w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]);
}

function schoolLevel(w: World, school: string): number {
  return skillLevel(w, school);
}

function requiredLevel(spell: SpellData, school: string): number {
  return spell.requirements?.[school] ?? spell.level;
}

function spellExcess(w: World, spell: SpellData): number {
  return Math.max(0, Math.min(...spell.schools.map((school) => schoolLevel(w, school) - requiredLevel(spell, school))));
}

export function knownSpells(w: World, school?: string): SpellData[] {
  return SPELLS.filter(
    (spell) =>
      ACTIVE_SPELL_SHAPES.includes(spell.shape) &&
      (!school || spell.schools.includes(school)) &&
      spell.schools.every((id) => schoolLevel(w, id) >= requiredLevel(spell, id)),
  );
}

function primarySchool(w: World): string | undefined {
  for (const id of Object.keys(w.heroDef.startingSkills)) {
    if (SPELL_SCHOOLS.includes(id)) return id;
  }
  return SPELL_SCHOOLS.find((id) => schoolLevel(w, id) > 0);
}

export function basicSpell(w: World): SpellData | undefined {
  if (w.heroDef.attackMode !== 'magic') return undefined;
  const school = primarySchool(w);
  if (!school) return undefined;
  const known = knownSpells(w, school).sort((a, b) => a.level - b.level);
  if (!known.length) return undefined;
  return known.length === 1 ? known[0] : known[known.length - 2];
}

export function paidSpells(w: World): SpellData[] {
  const out: SpellData[] = [];
  for (const school of SPELL_SCHOOLS) {
    if (!w.openSkills.has(school)) continue;
    const known = knownSpells(w, school).sort((a, b) => a.level - b.level);
    if (!known.length) continue;
    const top = known[known.length - 1]!;
    if (w.heroDef.attackMode === 'magic' && school === primarySchool(w) && known.length === 1) continue;
    if (top.shape === 'utility') out.push(...known.filter((spell) => spell.shape === 'utility'));
    else out.push(top);
  }
  return [...new Map(out.map((spell) => [spell.id, spell])).values()];
}

export function spellRange(w: World, spell: SpellData): number {
  return (spell.range ?? 0) + Math.floor(spellExcess(w, spell) / 2);
}

export function spellDamage(w: World, spell: SpellData): number {
  return (spell.damage ?? 0) + spellExcess(w, spell) * 2;
}

export function spellCandidates(w: World, spell: SpellData): Monster[] {
  const range = spellRange(w, spell);
  return w.monsters
    .filter((m) => m.hp > 0 && m.awake && visible(w, m) && Math.hypot(m.x - w.hero.x, m.y - w.hero.y) <= range)
    .sort((a, b) => {
      const priority = (m: Monster): number => (m.stats.throws ? 0 : 100) + Math.hypot(m.x - w.hero.x, m.y - w.hero.y);
      return priority(a) - priority(b);
    });
}

export function spellTarget(w: World, spell: SpellData): Monster | undefined {
  return spellCandidates(w, spell)[0];
}

function spellElement(spell: SpellData): ResistName | undefined {
  const types: readonly ResistName[] = ['fire', 'cold', 'electric', 'poison', 'negative'];
  return types.find((type) => spell.schools.includes(type)) ?? (spell.schools.includes('air') ? 'electric' : undefined);
}

type SpellCaster = 'hero' | 'monster';
type SpellActor = Hero | Monster;

/** Both allegiances resolve spell hits through the same target defence rules. */
function hitSpellTarget(
  w: World,
  caster: SpellCaster,
  target: SpellActor,
  damage: number,
  element?: ResistName,
  sourceMonster?: Monster,
): void {
  if (caster === 'hero') {
    hurtMonster(w, target as Monster, damage, element ?? 'physical', 'spell');
  } else {
    hurtHero(w, element ? 0 : damage, 'spell', sourceMonster, element ? { type: element, damage } : undefined);
  }
}

function enemiesOf(w: World, caster: SpellCaster): readonly SpellActor[] {
  return caster === 'hero' ? w.monsters : [w.hero];
}

function rayEnd(w: World, from: SpellActor, target: SpellActor, range: number): { x: number; y: number } {
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
    left: (range + 0.5) / speed,
    damage,
    pierce: spell.pierce ?? 0,
    colour: spell.colour,
    element: spellElement(spell),
    hit: [],
    caster,
    ...(caster === 'monster' ? { sourceMonster: from as Monster } : {}),
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
    if ('hp' in enemy && enemy.hp <= 0) continue;
    const t = Math.max(0, Math.min(1, ((enemy.x - from.x) * dx + (enemy.y - from.y) * dy) / length2));
    const px = from.x + dx * t;
    const py = from.y + dy * t;
    const radius = caster === 'hero' ? (enemy as Monster).stats.radius : w.heroDef.radius;
    if (Math.hypot(enemy.x - px, enemy.y - py) <= radius + 0.18) {
      hitSpellTarget(w, caster, enemy, damage, spellElement(spell), caster === 'monster' ? (from as Monster) : undefined);
    }
  }
  w.spellVisuals.push({
    shape: 'beam',
    x1: from.x,
    y1: from.y,
    x2: end.x,
    y2: end.y,
    radius: 0,
    colour: spell.colour,
    left: VISUAL_TIME,
  });
}

function castBurst(w: World, spell: SpellData, caster: SpellCaster, from: SpellActor, target: SpellActor, damage: number): void {
  const radius = spell.radius ?? 1;
  for (const enemy of enemiesOf(w, caster)) {
    if (enemy.hp <= 0) continue;
    const body = caster === 'hero' ? (enemy as Monster).stats.radius : w.heroDef.radius;
    if (Math.hypot(enemy.x - target.x, enemy.y - target.y) <= radius + body) {
      hitSpellTarget(w, caster, enemy, damage, spellElement(spell), caster === 'monster' ? (from as Monster) : undefined);
    }
  }
  w.spellVisuals.push({
    shape: 'burst',
    x1: target.x,
    y1: target.y,
    x2: target.x,
    y2: target.y,
    radius,
    colour: spell.colour,
    left: VISUAL_TIME,
  });
}

function castCloud(w: World, spell: SpellData, caster: SpellCaster, from: SpellActor, target: SpellActor, damage: number): void {
  const cloud: SpellCloud = {
    x: target.x,
    y: target.y,
    radius: spell.radius ?? 1,
    damage,
    left: spell.duration ?? 2,
    tick: spell.tick ?? 0.5,
    nextTick: 0,
    colour: spell.colour,
    element: spellElement(spell),
    caster,
    ...(caster === 'monster' ? { sourceMonster: from as Monster } : {}),
  };
  w.spellClouds.push(cloud);
  w.spellVisuals.push({
    shape: 'cloud',
    x1: target.x,
    y1: target.y,
    x2: target.x,
    y2: target.y,
    radius: cloud.radius,
    colour: spell.colour,
    left: VISUAL_TIME,
  });
}

/** Shared shape dispatcher: no separate monster spell effect implementations. */
function executeSpell(
  w: World,
  spell: SpellData,
  caster: SpellCaster,
  from: SpellActor,
  target: SpellActor,
  damage: number,
  range: number,
): void {
  if (spell.shape === 'projectile') castProjectile(w, spell, caster, from, target, damage, range);
  else if (spell.shape === 'beam') castBeam(w, spell, caster, from, target, damage, range);
  else if (spell.shape === 'burst') castBurst(w, spell, caster, from, target, damage);
  else if (spell.shape === 'cloud') castCloud(w, spell, caster, from, target, damage);
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
  executeSpell(w, spell, 'hero', w.hero, target, spellDamage(w, spell), spellRange(w, spell));
  const dx = target.x - w.hero.x;
  if (Math.abs(dx) > 0.15) w.hero.facing = dx < 0 ? -1 : 1;
}

/**
 * Monster uses the player's spells.json and shared shape/effect dispatcher.
 * Resources and ownership live on the caster, not on duplicate spell records.
 */
export function castMonsterSpell(w: World, monster: Monster, spellId: string): boolean {
  const spell = spellData(spellId);
  if (monster.mana < spell.mana || monster.spellCooldown > 0) return false;
  if (spell.shape === 'utility') {
    if (!applyUtilitySpell(w, spell, 'monster', monster)) return false;
  } else {
    if (!['projectile', 'beam', 'burst', 'cloud'].includes(spell.shape) || spell.damage === undefined || spell.range === undefined)
      return false;
    const d = Math.hypot(w.hero.x - monster.x, w.hero.y - monster.y);
    if (d > spell.range || !w.visible[Math.floor(monster.y) * w.grid.w + Math.floor(monster.x)]) return false;
    executeSpell(w, spell, 'monster', monster, w.hero, spell.damage, spell.range);
  }
  monster.mana -= spell.mana;
  monster.spellCooldown = Math.max(0.25, 0.45 - spell.level * 0.02);
  return true;
}

export function castPaidSpell(w: World, spellId: string, target?: Monster): boolean {
  const spell = spellData(spellId);
  if (!ACTIVE_SPELL_SHAPES.includes(spell.shape) || !paidSpells(w).some((entry) => entry.id === spell.id)) return false;
  if (w.hero.mana < spell.mana) return false;
  if (spell.shape === 'utility') {
    if (!applyUtilitySpell(w, spell, 'hero', w.hero)) return false;
    w.hero.mana -= spell.mana;
    return true;
  }
  const chosen = target ?? spellTarget(w, spell);
  if (!chosen || !spellCandidates(w, spell).includes(chosen)) return false;
  w.hero.mana -= spell.mana;
  w.hero.spellCooldown = Math.max(w.hero.spellCooldown, 0.25);
  execute(w, spell, chosen);
  return true;
}

function autoBasic(w: World): void {
  const spell = basicSpell(w);
  if (!spell || w.hero.spellCooldown > 0) return;
  const target = spellTarget(w, spell);
  if (!target) return;
  execute(w, spell, target);
  w.hero.spellCooldown = Math.max(0.35, 0.78 - spell.level * 0.04);
}

function tickProjectiles(w: World, dt: number): void {
  let kept = 0;
  for (const shot of w.spellShots) {
    shot.px = shot.x;
    shot.py = shot.y;
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.left -= dt;
    if (shot.left <= 0 || !walkable(w.grid, Math.floor(shot.x), Math.floor(shot.y))) continue;

    if (shot.caster === 'monster') {
      if (!shot.hitHero && Math.hypot(w.hero.x - shot.x, w.hero.y - shot.y) <= w.heroDef.radius + 0.16) {
        shot.hitHero = true;
        hitSpellTarget(w, 'monster', w.hero, shot.damage, shot.element, shot.sourceMonster);
        if (shot.pierce > 0) shot.pierce--;
        else continue;
      }
    } else {
      const hit = w.monsters.find(
        (m) => m.hp > 0 && !shot.hit.includes(m) && Math.hypot(m.x - shot.x, m.y - shot.y) <= m.stats.radius + 0.16,
      );
      if (hit) {
        shot.hit.push(hit);
        hitSpellTarget(w, 'hero', hit, shot.damage, shot.element);
        if (shot.pierce > 0) shot.pierce--;
        else continue;
      }
    }
    w.spellShots[kept++] = shot;
  }
  w.spellShots.length = kept;
}

function tickClouds(w: World, dt: number): void {
  let kept = 0;
  for (const cloud of w.spellClouds) {
    cloud.left -= dt;
    cloud.nextTick -= dt;
    if (cloud.nextTick <= 0) {
      cloud.nextTick += cloud.tick;
      const owner = cloud.caster ?? 'hero';
      for (const target of enemiesOf(w, owner)) {
        if (target.hp <= 0) continue;
        const radius = owner === 'hero' ? (target as Monster).stats.radius : w.heroDef.radius;
        if (Math.hypot(target.x - cloud.x, target.y - cloud.y) <= cloud.radius + radius) {
          hitSpellTarget(w, owner, target, cloud.damage, cloud.element, cloud.sourceMonster);
        }
      }
    }
    if (cloud.left > 0) w.spellClouds[kept++] = cloud;
  }
  w.spellClouds.length = kept;
}

function tickVisuals(w: World, dt: number): void {
  let kept = 0;
  for (const visual of w.spellVisuals) {
    visual.left -= dt;
    if (visual.left > 0) w.spellVisuals[kept++] = visual;
  }
  w.spellVisuals.length = kept;
}

function pruneDead(w: World): void {
  let kept = 0;
  for (const m of w.monsters) if (m.hp > 0) w.monsters[kept++] = m;
  w.monsters.length = kept;
}

export function stepSpells(w: World, dt: number): void {
  const h = w.hero;
  h.mana = Math.min(h.maxMana, h.mana + w.heroDef.manaRegen * dt);
  if (h.spellCooldown > 0) h.spellCooldown -= dt;
  tickProjectiles(w, dt);
  tickClouds(w, dt);
  tickVisuals(w, dt);
  if (w.heroDef.attackMode === 'magic' && h.hopTime <= 0) autoBasic(w);
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
  if (spell.shape === 'utility') return castPaidSpell(w, spellId);
  const target = spellAtPoint(w, spell, x, y);
  return target ? castPaidSpell(w, spellId, target) : false;
}
