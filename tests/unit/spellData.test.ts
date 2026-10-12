import { describe, expect, it } from 'vitest';
import { ACTIVE_SPELL_SHAPES, SPELLS, SPELL_SCHOOLS, schoolSpells, spellData } from '../../src/data/spells';
import { characterData } from '../../src/data/characters';
import characters from '../../src/data/json/characters.json';
import { ITEM_DEFINITIONS } from '../../src/data/itemCatalog';
import { SCHOOL_SKILLS } from '../../src/data/skills';
import { plainWeapon } from '../../src/data/items';
import {
  SPELL_SLOTS,
  basicSpell,
  castPaidSpell,
  knownSpells,
  lockedSpells,
  paidSpells,
  requiredLevel,
  setSpellSlot,
  spellDamage,
  spellRange,
  spellSlots,
  stepSpells,
} from '../../src/sim/spells';
import { makeWorld } from '../../src/sim/world';

const mage = (job: string) => makeWorld({ species: 'deep_elf', job, items: false, monsters: false });

describe('magic data: seven schools of nine spells', () => {
  it('has nine spells per school with automatic spells at levels 1, 4 and 7', () => {
    expect(SPELLS).toHaveLength(63);
    for (const school of SCHOOL_SKILLS) {
      const spells = schoolSpells(school);
      expect(spells.map((spell) => spell.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(spells.filter((spell) => spell.auto).map((spell) => spell.level)).toEqual([1, 4, 7]);
    }
    expect(SPELL_SCHOOLS).toHaveLength(7);
    expect(new Set(SPELLS.map((spell) => spell.id)).size).toBe(SPELLS.length);
  });

  it('only enables spells whose behaviour exists, and every school has a first auto attack', () => {
    for (const spell of SPELLS.filter((entry) => entry.enabled)) expect(ACTIVE_SPELL_SHAPES).toContain(spell.shape);
    for (const school of SCHOOL_SKILLS) expect(schoolSpells(school)[0]!.enabled).toBe(true);
    expect(spellData('chain_lightning').enabled).toBe(false);
    expect(spellData('rat_swarm').enabled).toBe(false);
  });

  it('carries the element in data, so ice is cold and earth is physical', () => {
    expect(spellData('split_lance').element).toBe('cold');
    expect(spellData('arc_needle').element).toBe('electric');
    expect(spellData('sling_stone').element).toBeUndefined();
    expect(spellData('bone_lance').element).toBe('negative');
  });

  it('keeps utility spells free of damage and range', () => {
    expect(spellData('blink_step').damage).toBeUndefined();
    expect(spellData('blink_step').range).toBeUndefined();
  });

  it('turns every enabled magic item into a working source of spells', () => {
    for (const item of ITEM_DEFINITIONS.filter((entry) => entry.enabled && ['staff', 'rod'].includes(entry.kind))) {
      const w = mage('fire_mage');
      w.weapon = plainWeapon(item.id);
      w.hero.skills[item.school!] = 27;
      expect(basicSpell(w), item.id).toBeDefined();
    }
  });
});

describe('mage jobs', () => {
  it('replaces the conjurer with one deep elf mage per school, each starting on its school staff', () => {
    expect(characters.some((entry) => entry.job === 'conjurer')).toBe(false);
    const start = (id: string) => {
      const entry = characterData(id);
      return makeWorld({ species: entry.species, job: entry.job, items: false, monsters: false });
    };
    for (const school of SCHOOL_SKILLS) {
      const entry = characters.find((row) => start(row.id).weapon.school === school);
      expect(entry, school).toBeDefined();
      expect(entry!.species).toBe('deep_elf');
      const w = start(entry!.id);
      expect(w.weapon.kind).toBe('staff');
      expect(basicSpell(w)?.level).toBe(1);
    }
  });
});

describe('equipment spell access', () => {
  it('needs no school skill for levels 1 and 2, then three per level', () => {
    expect(requiredLevel(spellData('arc_needle'))).toBe(0);
    expect(requiredLevel(spellData('focus_ray'))).toBe(0);
    expect(requiredLevel(spellData('gust'))).toBe(3);
    expect(requiredLevel(spellData('chain_lightning'))).toBe(6);
    expect(requiredLevel(spellData('thunder_descent'))).toBe(21);
  });

  it('a starting air mage auto-casts its level one spell and holds the first button', () => {
    const w = mage('air_mage');
    expect(basicSpell(w)?.id).toBe('arc_needle');
    expect(knownSpells(w).map((spell) => spell.id)).toEqual(['focus_ray']);
    expect(spellDamage(w, spellData('arc_needle'))).toBe(5 + 2 * skillExcess(w.hero.skills.air ?? 0, 0));
    expect(spellRange(w, spellData('arc_needle'))).toBeGreaterThanOrEqual(6);
  });

  it('uses the highest unlocked automatic spell the staff tier allows', () => {
    const w = mage('fire_mage');
    w.weapon = plainWeapon('staff_fire_2');
    w.hero.skills.fire = 0;
    expect(basicSpell(w)?.id).toBe('ember_dart');
    w.hero.skills.fire = 6;
    expect(basicSpell(w)?.id).toBe('fireball');
    w.hero.skills.fire = 15;
    expect(basicSpell(w)?.id).toBe('lava_lance');
    w.weapon = plainWeapon('staff_fire_1');
    expect(basicSpell(w)?.id).toBe('fireball');
  });

  it('a spellbook changes button spells and a rod supplies auto attack only', () => {
    const w = makeWorld({ species: 'barachi', job: 'spellblade', items: false, monsters: false });
    expect(paidSpells(w).map((spell) => spell.id)).toContain('blink_step');
    w.gear.offhand = 'spellbook_fire_0';
    expect(paidSpells(w).map((spell) => spell.id)).toContain('searing_line');
    expect(paidSpells(w).map((spell) => spell.id)).not.toContain('blink_step');
    expect(lockedSpells(w).map((spell) => spell.id)).toContain('ash_cloud');
    w.gear.offhand = undefined;
    w.weapon = plainWeapon('rod_fire_0');
    expect(paidSpells(w)).toHaveLength(0);
    expect(basicSpell(w)?.id).toBe('ember_dart');
  });
});

describe('four spell buttons', () => {
  const master = () => {
    const w = mage('earth_mage');
    w.weapon = plainWeapon('staff_earth_2');
    return w;
  };

  it('fills four slots with the highest unlocked spells, then the nearest locked ones', () => {
    const w = master();
    w.hero.skills.earth = 27;
    expect(spellSlots(w).map((spell) => spell?.id)).toEqual(['landslide', 'collapse_field', 'gravity_bloom', 'pulse_burst']);
    w.hero.skills.earth = 0;
    expect(spellSlots(w).map((spell) => spell?.id)).toEqual(['pulse_burst', 'gravity_bloom', 'collapse_field', 'landslide']);
  });

  it('keeps a pinned spell in its slot, moves it when pinned elsewhere, and refills when unequipped', () => {
    const w = master();
    w.hero.skills.earth = 27;
    expect(setSpellSlot(w, 0, 'pulse_burst')).toBe(true);
    expect(spellSlots(w)[0]?.id).toBe('pulse_burst');
    expect(spellSlots(w).filter((spell) => spell?.id === 'pulse_burst')).toHaveLength(1);
    expect(setSpellSlot(w, 2, 'pulse_burst')).toBe(true);
    expect(w.hero.spellSlots[0]).toBeUndefined();
    expect(spellSlots(w)[2]?.id).toBe('pulse_burst');
    expect(setSpellSlot(w, SPELL_SLOTS, 'pulse_burst')).toBe(false);
    expect(setSpellSlot(w, 0, 'ember_dart')).toBe(false);
    w.hero.spellSlots = [];
    expect(setSpellSlot(w, 3, 'landslide')).toBe(true);
    w.weapon = plainWeapon('staff_earth_0');
    expect(spellSlots(w).map((spell) => spell?.id)).toEqual(['pulse_burst', undefined, undefined, undefined]);
  });

  // Needs a school with more than four enabled button spells; none has that until phase B.
  it.todo('refuses to cast a spell that is not in a slot');
});

describe('per-spell cooldowns', () => {
  it('starts each button spell on its own cooldown and keeps others ready after the short gap', () => {
    const w = makeWorld({ species: 'barachi', job: 'spellblade', items: false, monsters: false });
    w.hero.skills.hexes = 27;
    w.gear.offhand = 'spellbook_hexes_1';
    w.hero.maxMana = 50;
    w.hero.mana = 50;
    expect(castPaidSpell(w, 'blink_step')).toBe(true);
    expect(w.hero.spellCooldowns.blink_step).toBe(spellData('blink_step').cooldown);
    expect(castPaidSpell(w, 'phase_guard')).toBe(false);
    stepSpells(w, 0.3);
    expect(castPaidSpell(w, 'phase_guard')).toBe(true);
    expect(castPaidSpell(w, 'blink_step')).toBe(false);
    stepSpells(w, spellData('blink_step').cooldown!);
    expect(w.hero.spellCooldowns.blink_step).toBeUndefined();
    expect(castPaidSpell(w, 'blink_step')).toBe(true);
  });
});

function skillExcess(level: number, required: number): number {
  return Math.max(0, level - required);
}
