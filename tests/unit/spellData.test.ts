import { describe, expect, it } from 'vitest';
import { ACTIVE_SPELL_SHAPES, SPELLS, SPELL_SCHOOLS, schoolSpells, spellData } from '../../src/data/spells';
import { knownSpells, spellDamage, spellRange } from '../../src/sim/spells';
import { makeWorld } from '../../src/sim/world';

describe('expanded spell data', () => {
  it('uses schools arrays and preserves existing spells', () => {
    expect(SPELLS).toHaveLength(12);
    expect(SPELL_SCHOOLS).toContain('conjuration');
    expect(SPELL_SCHOOLS).toContain('translocation');
    expect(spellData('arc_needle').schools).toEqual(['conjuration']);
    expect(schoolSpells('fire').map((spell) => spell.id)).toContain('ash_cloud');
  });

  it('allows utility spells without damage or range', () => {
    expect(spellData('blink_step').damage).toBeUndefined();
    expect(spellData('blink_step').range).toBeUndefined();
    expect(ACTIVE_SPELL_SHAPES).toContain('utility');
  });

  it('requires all schools for multi-school spells and deduplicates them', () => {
    const w = makeWorld({ species: 'deep_elf', job: 'conjurer', seed: 123 });
    const original = SPELLS[0]!;
    const combined = {
      ...original,
      id: 'test_dual',
      schools: ['conjuration', 'fire'],
      requirements: { conjuration: 2, fire: 3 },
    };
    expect(combined.schools.every((id) => (w.hero.skills[id] ?? 0) >= combined.requirements[id as keyof typeof combined.requirements])).toBe(false);
    w.hero.skills.conjuration = 4;
    w.hero.skills.fire = 3;
    expect(combined.schools.every((id) => (w.hero.skills[id] ?? 0) >= combined.requirements[id as keyof typeof combined.requirements])).toBe(true);
    expect(spellDamage(w, combined)).toBe(combined.damage!);
    expect(spellRange(w, combined)).toBe(combined.range);
    expect(knownSpells(w, 'conjuration').some((spell) => spell.schools.includes('fire'))).toBe(false);
  });
});
