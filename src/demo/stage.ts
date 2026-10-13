import { plainWeapon } from '../data/items';
import { DUNGEON } from '../data/packs';
import { schoolSpells, spellData, type SpellData } from '../data/spells';
import { carve, makeGrid } from '../sim/grid';
import { spawnMonster } from '../sim/monster';
import { castAt, castPaidSpell, setSpellSlot, spellTarget } from '../sim/spells';
import type { MonsterStats } from '../data/monsters';
import type { Monster, World } from '../sim/types';
import { makeWorld, stepWorld, STEP, type Input } from '../sim/world';

/**
 * A practice room for watching spells: the real rules and the real drawing, one open room,
 * the hero on the left and six practice dummies on the right that never fight back.
 */
export const MAGE_JOBS: Readonly<Record<string, string>> = {
  fire: 'fire_mage',
  ice: 'ice_mage',
  air: 'air_mage',
  earth: 'earth_mage',
  summoning: 'summoner',
  hexes: 'hexer',
  necromancy: 'necromancer',
};

const DUMMIES: readonly { readonly id: string; readonly x: number; readonly y: number }[] = [
  { id: 'goblin', x: 9, y: 8.5 },
  { id: 'gnoll', x: 10.6, y: 7.2 },
  { id: 'jackal', x: 10.6, y: 9.8 },
  { id: 'ogre', x: 12.2, y: 8.5 },
  { id: 'rat', x: 11.8, y: 6 },
  { id: 'goblin', x: 11.8, y: 11 },
];

const RESPAWN = 1.2;
const STILL: Input = { mx: 0, my: 0 };

export interface StageOptions {
  /** Dummies walk at the hero (they still cannot hurt it). */
  moving: boolean;
  /** Dummies heal fully every step, so nothing ever dies. */
  endless: boolean;
}

export interface Stage {
  readonly world: World;
  readonly school: string;
  spell: SpellData;
  /** Seconds until each empty dummy spot fills again. */
  readonly respawn: number[];
  readonly dummies: (Monster | undefined)[];
}

function practiceRoom(): {
  grid: ReturnType<typeof makeGrid>;
  start: { x: number; y: number };
  rooms: { x: number; y: number; w: number; h: number }[];
} {
  const grid = makeGrid(20, 17);
  carve(grid, 1, 1, 18, 15);
  return { grid, start: { x: 5, y: 8.5 }, rooms: [{ x: 1, y: 1, w: 18, h: 15 }] };
}

function placeDummy(stage: Stage, index: number, options: StageOptions): void {
  const spot = DUMMIES[index]!;
  const m = spawnMonster(stage.world, spot.id, spot.x, spot.y, true);
  m.rewardless = true;
  if (!options.moving) (m as { stats: MonsterStats }).stats = { ...m.stats, speed: 0 };
  stage.dummies[index] = m;
}

/** The smallest staff tier that still holds the spell, so an automatic spell is the one the staff fires. */
function tierFor(spell: SpellData): number {
  return DUNGEON.magicTierMaxLevel.findIndex((max) => spell.level <= max);
}

/** Equips the right staff for the chosen spell. Automatic spells fire by themselves; button spells wait for a cast. */
export function chooseSpell(stage: Stage, spellId: string): void {
  const spell = spellData(spellId);
  const w = stage.world;
  stage.spell = spell;
  w.weapon = plainWeapon('staff_' + spell.school + '_' + (spell.auto ? tierFor(spell) : 2));
  w.hero.autoCooldown = spell.auto ? 0 : Infinity;
  w.hero.spellCooldowns = {};
  w.hero.spellSlots = [];
  if (!spell.auto) setSpellSlot(w, 0, spell.id);
}

export function makeStage(school: string, options: StageOptions): Stage {
  const world = makeWorld({ floor: practiceRoom(), species: 'deep_elf', job: MAGE_JOBS[school]!, monsters: false, items: false, seed: 7 });
  world.hero.skills[school] = 27;
  const stage: Stage = { world, school, spell: schoolSpells(school)[0]!, respawn: [], dummies: [] };
  DUMMIES.forEach((_, i) => placeDummy(stage, i, options));
  return stage;
}

/** Casts the chosen button spell, aimed at a point (a tap) or at the nearest dummy. Cooldown and mana never stop the demo. */
export function castNow(stage: Stage, at?: { x: number; y: number }): boolean {
  const { world: w, spell } = stage;
  if (spell.auto || !spell.enabled) return false;
  w.hero.mana = w.hero.maxMana;
  w.hero.spellCooldowns = {};
  w.hero.spellCooldown = 0;
  if (at && castAt(w, spell.id, at.x, at.y)) return true;
  return castPaidSpell(w, spell.id, spellTarget(w, spell));
}

/** One step of the real rules, with the room kept as a practice room. */
export function stepStage(stage: Stage, options: StageOptions): void {
  const w = stage.world;
  const h = w.hero;
  h.invulnerable = 1e9;
  h.hp = h.maxHp;
  h.mana = Math.max(h.mana, h.maxMana * 0.5);
  w.floorTime = 0;
  w.nextBand = Infinity;
  stepWorld(w, STILL);
  w.rewardChoices = null;
  w.pendingRewards.length = 0;
  w.choosing = null;
  stage.dummies.forEach((m, i) => {
    if (m && m.hp > 0) {
      if (options.endless) m.hp = m.maxHp;
      return;
    }
    stage.dummies[i] = undefined;
    stage.respawn[i] = (stage.respawn[i] ?? RESPAWN) - STEP;
    if (stage.respawn[i]! <= 0) {
      stage.respawn[i] = RESPAWN;
      placeDummy(stage, i, options);
    }
  });
}

/** Turns dummy walking on or off without rebuilding the room. */
export function setMoving(stage: Stage, options: StageOptions): void {
  for (const m of stage.dummies) {
    if (!m) continue;
    const speed = options.moving ? m.kind.stats.speed : 0;
    (m as { stats: MonsterStats }).stats = { ...m.stats, speed };
  }
}
