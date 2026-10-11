import { monsterKind } from '../data/monsters';
import { DUNGEON } from '../data/packs';
import { spellData } from '../data/spells';
import { hurtHero, wake } from './effects';
import { downhill } from './flow';
import type { Monster, World } from './types';

export function spawnMonster(w: World, id: string, x: number, y: number, awake: boolean, pack = w.nextPack++): Monster {
  const kind = monsterKind(id);
  const hp = Math.round(kind.stats.hp * (1 + DUNGEON.tougher * (w.depth - 1)));
  const m: Monster = {
    kind,
    stats: kind.stats,
    pack,
    maxHp: hp,
    x,
    y,
    px: x,
    py: y,
    hp,
    awake,
    wind: -1,
    attackMode: 'melee',
    queuedSpell: undefined,
    rest: w.rng() * 0.4,
    stun: 0,
    flit: 0,
    fx: 0,
    fy: 0,
    kx: 0,
    ky: 0,
    flash: 0,
    slow: 0,
    slowScale: 0,
    burning: 0,
    burnDamage: 0,
    facing: -1,
  };
  w.monsters.push(m);
  return m;
}
const GRACE = 0.12,
  STRAIGHT = 14,
  BUMP = 1.4;
type Stride = { vx: number; vy: number };
function speedOf(m: Monster): number {
  return m.stats.speed * (m.slow > 0 ? 1 - m.slowScale : 1);
}
/** Actions are scored every frame; no monster-specific decision tree is needed.
 * Scores are relative preferences, not probabilities. Invalid actions are omitted.
 * A committed windup is never reselected, preventing jitter and free cancellations.
 */
export type MonsterAction = 'melee' | 'ranged' | 'spell' | 'approach' | 'retreat' | 'hold';
export interface ScoredAction { readonly action: MonsterAction; readonly score: number; readonly spellId?: string }
type Context = { readonly d: number; readonly reach: number; readonly visible: boolean; readonly ready: boolean };
const STOP: Stride = { vx: 0, vy: 0 };

/** Candidate generation is separate from execution, so future actions (heal,
 * summon, equip, flee) can join the same competition without changing thinkMonster.
 */
export function monsterActions(m: Monster, c: Context): ScoredAction[] {
  const ai = m.stats.ai;
  const preferred = ai?.preferredRange ?? m.stats.throws?.keep ?? 0;
  const options: ScoredAction[] = [{ action: 'hold', score: 0 }];
  if (c.visible && c.d <= c.reach) {
    options.push({ action: 'melee', score: c.ready ? 100 + (ai?.aggression ?? 0) : -10 });
  }
  if (c.visible && m.stats.throws && c.d > c.reach && c.d <= m.stats.throws.range) {
    options.push({ action: 'ranged', score: c.ready ? 90 + (ai?.rangedBias ?? 0) : -10 });
  }
  // Spell definitions come from the same spells.json used by the player.
  // Only supported projectile spells are candidates until shared spell effects
  // support hostile casters; unsupported shapes must never silently fire.
  if (c.visible && c.ready && c.d > c.reach) {
    for (const spellId of ai?.spells ?? []) {
      const spell = spellData(spellId);
      if (spell.shape === 'projectile' && spell.damage !== undefined && spell.range !== undefined && c.d <= spell.range)
        options.push({ action: 'spell', spellId, score: 95 + (ai?.spellBias ?? 0) });
    }
  }
  if (preferred > 0 && c.visible && c.d < preferred && c.d > c.reach) {
    options.push({ action: 'retreat', score: 70 + (preferred - c.d) * 5 });
  }
  if (!c.visible || c.d > c.reach) {
    // Ranged attackers approach only when their target is outside effective range.
    const needsRange = !c.visible || (preferred > 0 ? c.d > (m.stats.throws?.range ?? preferred) : true);
    if (needsRange) options.push({ action: 'approach', score: 60 });
    else if (preferred === 0) options.push({ action: 'approach', score: 60 });
  }
  return options.sort((a, b) => b.score - a.score);
}
function launch(w: World, m: Monster, dx: number, dy: number, d: number): void {
  const spell = m.attackMode === 'spell' && m.queuedSpell ? spellData(m.queuedSpell) : undefined;
  const range = spell?.range ?? m.stats.throws?.range ?? 0;
  const speed = spell?.speed ?? m.stats.throws?.speed ?? 10;
  w.shots.push({
    x: m.x, y: m.y, px: m.x, py: m.y,
    vx: (dx / d) * speed, vy: (dy / d) * speed,
    damage: spell?.damage ?? m.stats.damage,
    left: (range + 2) / speed, mine: false, pierce: 0,
    returns: false, returning: false, hit: [],
  });
}
function follow(w: World, m: Monster, speed: number): Stride {
  const way = downhill(w.flow, w.grid, m.x, m.y);
  return way ? { vx: way.x * speed, vy: way.y * speed } : STOP;
}
export function thinkMonster(w: World, m: Monster, dt: number): Stride {
  const still = { vx: 0, vy: 0 },
    hero = w.hero,
    dx = hero.x - m.x,
    dy = hero.y - m.y,
    d = Math.hypot(dx, dy) || 1e-6;
  const inView = w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)] === 1;
  if (m.flash > 0) m.flash -= dt;
  if (m.slow > 0) {
    m.slow -= dt;
    if (m.slow <= 0) m.slowScale = 0;
  }
  if (!m.awake) {
    if (d > BUMP && (!inView || d > m.stats.notice)) return still;
    wake(w, m);
  }
  if (m.rest > 0) m.rest -= dt;
  if (m.stun > 0) {
    m.stun -= dt;
    m.wind = -1;
    return still;
  }
  if (Math.abs(dx) > 0.05) m.facing = dx < 0 ? -1 : 1;

  const speed = speedOf(m);
  if (m.wind >= 0) {
    m.wind -= dt;
    if (m.wind < 0) {
      const reach = w.heroDef.radius + m.stats.reach;
      if (m.attackMode === 'melee') {
        if (d <= reach + GRACE) {
          const landed = hurtHero(w, m.stats.damage, 'melee', m, m.stats.elemental);
          if (landed && m.stats.poison) hero.poison = Math.max(hero.poison, m.stats.poison);
        }
      } else if (inView && d > reach && d <= (m.attackMode === 'spell' && m.queuedSpell ? (spellData(m.queuedSpell).range ?? 0) : (m.stats.throws?.range ?? 0))) {
        launch(w, m, dx, dy, d);
      }
      m.rest = m.stats.rest;
      m.queuedSpell = undefined;
      if (m.stats.flits && m.attackMode === 'melee') {
        const angle = Math.atan2(-dy, -dx) + (w.rng() - 0.5) * 2.4;
        m.flit = m.stats.flits * (0.6 + w.rng() * 0.8);
        m.fx = Math.cos(angle);
        m.fy = Math.sin(angle);
      }
    }
    return still;
  }
  if (m.flit > 0) {
    m.flit -= dt;
    return { vx: m.fx * speed, vy: m.fy * speed };
  }
  const reach = w.heroDef.radius + m.stats.reach;
  const actions = monsterActions(m, { d, reach, visible: inView, ready: m.rest <= 0 });
  const best = actions[0]!;
  if (best.action === 'melee' || best.action === 'ranged' || best.action === 'spell') {
    m.attackMode = best.action;
    m.queuedSpell = best.spellId;
    m.wind = m.stats.windup;
    return still;
  }
  if (best.action === 'retreat') return { vx: (-dx / d) * speed, vy: (-dy / d) * speed };
  if (best.action === 'approach') {
    if (d <= w.heroDef.radius + m.stats.radius + 0.02) return still;
    if (inView && d < STRAIGHT) return { vx: (dx / d) * speed, vy: (dy / d) * speed };
    return follow(w, m, speed);
  }
  return still;
}
