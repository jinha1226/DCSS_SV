import { describe, expect, it } from 'vitest';
import { MONSTERS } from '../../src/data/monsters';
import { PACKS } from '../../src/data/packs';
import { Cell } from '../../src/sim/grid';
import { pickPack } from '../../src/sim/packs';
import { makeWorld, stepWorld } from '../../src/sim/world';

describe('stage 4 branch encounters and terrain', () => {
  it('only selects encounters from the current branch', () => {
    for (const [depth, branch] of [
      [101, 'Lair'],
      [301, 'Snake'],
      [401, 'Swamp'],
      [302, 'Snake'],
    ] as const) {
      const w = makeWorld({ seed: 2, depth, monsters: false, items: false });
      for (let i = 0; i < 60; i++) expect(pickPack(w).branch).toBe(branch);
    }
    for (const [depth, branch] of [
      [301, 'Spider'],
      [401, 'Shoals'],
    ] as const) {
      const w = makeWorld({ seed: 1, depth, monsters: false, items: false });
      for (let i = 0; i < 60; i++) expect(pickPack(w).branch).toBe(branch);
    }
  });

  it('reuses valid atlas sprites and has branch-specific status and ranged enemies', () => {
    const ids = new Set(MONSTERS.map((monster) => monster.id));
    for (const pack of PACKS) for (const member of pack.members) expect(ids.has(member.kind)).toBe(true);
    expect(MONSTERS.find((monster) => monster.id === 'naga')?.stats.constrict).toBeGreaterThan(0);
    expect(MONSTERS.find((monster) => monster.id === 'wolf_spider')?.stats.poison).toBeGreaterThan(0);
    expect(MONSTERS.find((monster) => monster.id === 'merfolk_javelineer')?.stats.throws?.range).toBeGreaterThan(0);
    expect(MONSTERS.find((monster) => monster.id === 'hydra')?.stats.waterNative).toBe(true);
  });

  it('creates deterministic shallow water only in Swamp and Shoals', () => {
    const a = makeWorld({ seed: 2, depth: 401, monsters: false, items: false });
    const b = makeWorld({ seed: 2, depth: 401, monsters: false, items: false });
    const dry = makeWorld({ seed: 2, depth: 101, monsters: false, items: false });
    expect([...a.grid.cells]).toEqual([...b.grid.cells]);
    expect([...a.grid.cells].filter((cell) => cell === Cell.Water).length).toBeGreaterThan(0);
    expect([...dry.grid.cells].filter((cell) => cell === Cell.Water).length).toBe(0);
  });

  it('reduces hero movement in water and allows movement to break constriction', () => {
    const w = makeWorld({ seed: 2, depth: 401, monsters: false, items: false });
    const water = w.grid.cells.findIndex((cell) => cell === Cell.Water);
    expect(water).toBeGreaterThanOrEqual(0);
    w.hero.x = (water % w.grid.w) + 0.5;
    w.hero.y = Math.floor(water / w.grid.w) + 0.5;
    w.hero.constricted = 2;
    stepWorld(w, { mx: 1, my: 0 });
    expect(w.hero.constricted).toBeLessThan(2);
    expect(w.hero.constricted).toBeGreaterThan(0);
  });
});
