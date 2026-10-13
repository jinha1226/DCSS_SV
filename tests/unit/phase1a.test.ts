import { describe, expect, it } from 'vitest';
import { heroFor } from '../../src/data/hero';
import species from '../../src/data/json/species.json';
import jobs from '../../src/data/json/jobs.json';
import { makeWorld } from '../../src/sim/world';
import { stoneBodyArmour } from '../../src/sim/traits';

describe('phase 1a species and Fighter', () => {
  it('keeps aptitude conversion for existing species and representative new aptitudes', () => {
    const at = (id: string) => species.find((row) => row.id === id)!.aptitudes;
    expect(at('minotaur')).toMatchObject({ fighting: 'good', dodging: 'normal', earth: 'bad' });
    expect(at('barachi')).toMatchObject({ fighting: 'good', axe: 'normal', summoning: 'normal' });
    expect(at('deep_elf')).toMatchObject({ fighting: 'bad', dodging: 'good', spellcasting: 'good' });
    expect(at('gargoyle').earth).toBe('good');
    expect(at('troll').spellcasting).toBe('bad');
    expect(at('mountain_dwarf').axe).toBe('good');
  });

  it('constructs every playable species and job combination', () => {
    for (const s of species) for (const j of jobs) expect(() => makeWorld({ species: s.id, job: j.id, monsters: false })).not.toThrow();
  });

  it('supports the implemented species traits', () => {
    expect(heroFor('gargoyle', 'fighter').resists.electric).toBe(1);
    expect(heroFor('troll', 'fighter').regen).toBeGreaterThan(heroFor('minotaur', 'fighter').regen);
    expect(heroFor('troll', 'fighter').radius).toBeGreaterThan(heroFor('minotaur', 'fighter').radius);
  });
});

describe('gargoyle stone body', () => {
  it('gives armour that grows with level, as DCSS stone_body_armour_bonus at half scale', () => {
    const w = makeWorld({ species: 'gargoyle', job: 'fighter', monsters: false, items: false });
    expect(stoneBodyArmour(w)).toBeCloseTo((2 + 0.4) * 0.5);
    w.hero.level = 27;
    expect(stoneBodyArmour(w)).toBeCloseTo((2 + 0.4 * 27 + 0.4 * 20) * 0.5);
    const m = makeWorld({ species: 'minotaur', job: 'fighter', monsters: false, items: false });
    expect(stoneBodyArmour(m)).toBe(0);
  });
});
