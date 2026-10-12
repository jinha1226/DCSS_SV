import { describe, expect, it } from 'vitest';
import { ACTIVE_SPELL_SHAPES, SPELLS, SPELL_SCHOOLS, schoolSpells, spellData } from '../../src/data/spells';
import { knownSpells, paidSpells, basicSpell, lockedSpells, requiredLevel, spellDamage, spellRange } from '../../src/sim/spells';
import { makeWorld } from '../../src/sim/world';

describe('single-school spell data and equipment spell access', () => {
  it('validates a single assigned school for each of the existing spells', () => {
    expect(SPELLS).toHaveLength(12);
    expect(SPELL_SCHOOLS).toContain('air');
    expect(SPELL_SCHOOLS).toContain('hexes');
    expect(spellData('arc_needle').school).toBe('air');
    expect(schoolSpells('fire').map((spell) => spell.id)).toContain('ash_cloud');
    expect(new Set(SPELLS.map((spell) => spell.id)).size).toBe(SPELLS.length);
  });

  it('allows utility spells without damage or range', () => {
    expect(spellData('blink_step').damage).toBeUndefined();
    expect(spellData('blink_step').range).toBeUndefined();
    expect(ACTIVE_SPELL_SHAPES).toContain('utility');
  });

  it('level-one spells are usable at school zero while higher levels lock', () => {
    const w = makeWorld({ species: 'deep_elf', job: 'conjurer', items: false, monsters: false });
    w.hero.skills.air = 0;
    expect(requiredLevel(spellData('arc_needle'))).toBe(0);
    expect(requiredLevel(spellData('focus_ray'))).toBe(3);
    expect(knownSpells(w).map((spell) => spell.id)).toContain('arc_needle');
    expect(lockedSpells(w).map((spell) => spell.id)).toContain('focus_ray');
    expect(basicSpell(w)?.id).toBe('arc_needle');
    expect(spellDamage(w, spellData('arc_needle'))).toBe(5);
    expect(spellRange(w, spellData('arc_needle'))).toBe(6);
  });

  it('a spellbook changes button spells and a rod supplies auto attack only', () => {
    const w = makeWorld({ species: 'barachi', job: 'spellblade', items: false, monsters: false });
    expect(paidSpells(w).map((spell) => spell.id)).toContain('blink_step');
    w.gear.offhand = 'spellbook_fire_0';
    expect(paidSpells(w).map((spell) => spell.id)).toContain('ember_dart');
    expect(paidSpells(w).map((spell) => spell.id)).not.toContain('blink_step');
    w.gear.offhand = undefined;
    w.weapon = { ...w.weapon, kind: 'rod', school: 'fire', tier: 0, power: 0.65 };
    expect(paidSpells(w)).toHaveLength(0);
    expect(basicSpell(w)?.id).toBe('ember_dart');
  });
});
