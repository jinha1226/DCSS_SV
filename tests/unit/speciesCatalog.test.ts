import { describe, expect, it } from 'vitest';
import speciesCatalog from '../../src/data/json/species.catalog.json';
import activeSpecies from '../../src/data/json/species.json';

describe('DCSS-inspired species catalog', () => {
  it('lists 27 distinct species', () => {
    expect(speciesCatalog).toHaveLength(27);
    expect(new Set(speciesCatalog.map((row) => row.id)).size).toBe(27);
  });

  it('keeps all implemented species playable', () => {
    const ready = speciesCatalog.filter((row) => row.playable);
    expect(ready.map((row) => row.id).sort()).toEqual(activeSpecies.map((row) => row.id).sort());
    expect(ready).toHaveLength(6);
  });

  it('identifies required systems for unimplemented species', () => {
    for (const species of speciesCatalog) {
      expect(species.name.length).toBeGreaterThan(0);
      expect(species.identity.length).toBeGreaterThan(0);
      expect(species.signatureTrait.length).toBeGreaterThan(0);
      expect(species.implementation).toBe(species.playable ? 'ready' : 'planned');
      if (!species.playable) expect(species.requires.length).toBeGreaterThan(0);
    }
  });
});
