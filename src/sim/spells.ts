import { SPELLS, SPELL_SCHOOLS, schoolSpells, spellData, type SpellData } from '../data/spells';
import { walkable } from './grid';
import { recordKill } from './kills';
import { skillLevel } from './skills';
import { wake } from './effects';
import type { Monster, SpellCloud, SpellShot, World } from './types';

const VISUAL_TIME = 0.18;

function visible(w: World, m: Monster): boolean {
  return Boolean(w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]);
}

function schoolLevel(w: World, school: string): number {
  return skillLevel(w, school);
}

export function knownSpells(w: World, school?: string): SpellData[] {
  return SPELLS.filter((spell) => (!school || spell.school === school) && schoolLevel(w, spell.school) >= spell.level);
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
    out.push(top);
  }
  return out;
}

export function spellRange(w: World, spell: SpellData): number {
  const excess = Math.max(0, schoolLevel(w, spell.school) - spell.level);
  return spell.range + Math.floor(excess / 2);
}

export function spellDamage(w: World, spell: SpellData): number {
  const excess = Math.max(0, schoolLevel(w, spell.school) - spell.level);
  return spell.damage + excess * 2;
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

function hitMonster(w: World, m: Monster, amount: number): void {
  if (m.hp <= 0) return;
  m.hp -= amount;
  m.flash = 0.12;
  wake(w, m);
  w.events.push({ type: 'hit', x: m.x, y: m.y, amount, by: 'spell' });
  recordKill(w, m);
}

function rayEnd(w: World, target: Monster, range: number): { x: number; y: number } {
  const dx = target.x - w.hero.x;
  const dy = target.y - w.hero.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  let x = w.hero.x;
  let y = w.hero.y;
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

function castProjectile(w: World, spell: SpellData, target: Monster, damage: number): void {
  const speed = spell.speed ?? 16;
  const range = spellRange(w, spell);
  const dx = target.x - w.hero.x;
  const dy = target.y - w.hero.y;
  const d = Math.hypot(dx, dy) || 1;
  const shot: SpellShot = {
    x: w.hero.x,
    y: w.hero.y,
    px: w.hero.x,
    py: w.hero.y,
    vx: (dx / d) * speed,
    vy: (dy / d) * speed,
    left: (range + 0.5) / speed,
    damage,
    pierce: spell.pierce ?? 0,
    colour: spell.colour,
    hit: [],
  };
  w.spellShots.push(shot);
}

function castBeam(w: World, spell: SpellData, target: Monster, damage: number): void {
  const end = rayEnd(w, target, spellRange(w, spell));
  const dx = end.x - w.hero.x;
  const dy = end.y - w.hero.y;
  const length2 = dx * dx + dy * dy || 1;
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    const t = Math.max(0, Math.min(1, ((m.x - w.hero.x) * dx + (m.y - w.hero.y) * dy) / length2));
    const px = w.hero.x + dx * t;
    const py = w.hero.y + dy * t;
    if (Math.hypot(m.x - px, m.y - py) <= m.stats.radius + 0.18) hitMonster(w, m, damage);
  }
  w.spellVisuals.push({
    shape: 'beam',
    x1: w.hero.x,
    y1: w.hero.y,
    x2: end.x,
    y2: end.y,
    radius: 0,
    colour: spell.colour,
    left: VISUAL_TIME,
  });
}

function castBurst(w: World, spell: SpellData, target: Monster, damage: number): void {
  const radius = spell.radius ?? 1;
  for (const m of w.monsters) {
    if (m.hp > 0 && Math.hypot(m.x - target.x, m.y - target.y) <= radius + m.stats.radius) hitMonster(w, m, damage);
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

function castCloud(w: World, spell: SpellData, target: Monster, damage: number): void {
  const cloud: SpellCloud = {
    x: target.x,
    y: target.y,
    radius: spell.radius ?? 1,
    damage,
    left: spell.duration ?? 2,
    tick: spell.tick ?? 0.5,
    nextTick: 0,
    colour: spell.colour,
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

function execute(w: World, spell: SpellData, target: Monster): void {
  const damage = spellDamage(w, spell);
  if (spell.shape === 'projectile') castProjectile(w, spell, target, damage);
  else if (spell.shape === 'beam') castBeam(w, spell, target, damage);
  else if (spell.shape === 'burst') castBurst(w, spell, target, damage);
  else castCloud(w, spell, target, damage);
  const dx = target.x - w.hero.x;
  if (Math.abs(dx) > 0.15) w.hero.facing = dx < 0 ? -1 : 1;
}

export function castPaidSpell(w: World, spellId: string, target?: Monster): boolean {
  const spell = spellData(spellId);
  if (!paidSpells(w).some((entry) => entry.id === spell.id)) return false;
  if (w.hero.mana < spell.mana) return false;
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
    const hit = w.monsters.find(
      (m) => m.hp > 0 && !shot.hit.includes(m) && Math.hypot(m.x - shot.x, m.y - shot.y) <= m.stats.radius + 0.16,
    );
    if (hit) {
      shot.hit.push(hit);
      hitMonster(w, hit, shot.damage);
      if (shot.pierce > 0) shot.pierce--;
      else continue;
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
      for (const m of w.monsters) {
        if (m.hp > 0 && Math.hypot(m.x - cloud.x, m.y - cloud.y) <= cloud.radius + m.stats.radius) {
          hitMonster(w, m, cloud.damage);
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
