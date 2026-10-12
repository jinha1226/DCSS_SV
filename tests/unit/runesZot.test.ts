import { describe, expect, it } from 'vitest';
import { downDestinations } from '../../src/sim/dungeonGraph';
import { objectiveFor, collectObjective } from '../../src/sim/objectives';
import { makeWorld, stepWorld } from '../../src/sim/world';

const STILL = { mx: 0, my: 0 };
function standOnObjective(w: ReturnType<typeof makeWorld>): void {
  const objective = objectiveFor(w);
  expect(objective).toBeDefined();
  w.hero.x = objective!.x;
  w.hero.y = objective!.y;
}
function clearObjective(w: ReturnType<typeof makeWorld>): void {
  w.monsters.length = 0;
  standOnObjective(w);
  collectObjective(w);
}

describe('stage 5: runes and Zot victory', () => {
  it('places a rune on each seeded rune branch floor three, but nowhere else', () => {
    for (const seed of [1, 2, 3, 4]) {
      for (const depth of [303, 403]) {
        const w = makeWorld({ seed, depth, monsters: false, items: false });
        const objective = objectiveFor(w);
        expect(objective?.kind).toBe('rune');
        expect(objective?.branch).toBe(w.dungeonGraph.nodes.get(depth)?.branch);
        expect(objective?.x).toBeGreaterThan(0);
      }
      expect(objectiveFor(makeWorld({ seed, depth: 302, monsters: false, items: false }))).toBeUndefined();
    }
  });

  it('collects two distinct runes exactly once, independent of item spawning', () => {
    const w = makeWorld({ seed: 1, depth: 303, monsters: false, items: false });
    clearObjective(w);
    expect(w.runes.size).toBe(1);
    expect(w.events.filter((event) => event.type === 'rune')).toHaveLength(1);
    collectObjective(w);
    expect(w.events.filter((event) => event.type === 'rune')).toHaveLength(1);
    w.depth = 403;
    const second = makeWorld({ seed: 1, depth: 403, monsters: false, items: false });
    w.grid = second.grid;
    w.rooms = second.rooms;
    w.stairs = second.stairs;
    clearObjective(w);
    expect(w.runes.size).toBe(2);
    expect(w.runes.has('Spider')).toBe(true);
    expect(w.runes.has('Shoals')).toBe(true);
  });

  it('does not allow taking a guarded objective until nearby threats are defeated', () => {
    const w = makeWorld({ seed: 1, depth: 303, monsters: true, items: false });
    const objective = objectiveFor(w)!;
    expect(w.monsters.length).toBeGreaterThan(0);
    const guard = w.monsters[0]!;
    guard.x = objective.x + 0.5;
    guard.y = objective.y;
    standOnObjective(w);
    collectObjective(w);
    expect(w.runes.size).toBe(0);
    w.monsters.length = 0;
    collectObjective(w);
    expect(w.runes.size).toBe(1);
  });

  it('blocks Zot entrance with zero or one rune, and admits both', () => {
    const w = makeWorld({ seed: 1, depth: 703, monsters: false, items: false });
    const down = w.stairs.find((stair) => stair.down)!;
    for (let n = 0; n < 2; n++) {
      w.hero.x = down.x + 0.5;
      w.hero.y = down.y + 0.5;
      stepWorld(w, STILL, 1);
      expect(w.depth).toBe(703);
      if (n === 0) w.runes.add(w.dungeonGraph.runeBranches[0]);
    }
    w.runes.add(w.dungeonGraph.runeBranches[1]);
    stepWorld(w, STILL, 1);
    expect(w.depth).toBe(801);
    expect(downDestinations(w.dungeonGraph, 801)).toEqual([802]);
  });

  it('cannot win on Zot entry or final stairs; only taking the Orb wins', () => {
    const w = makeWorld({ seed: 2, depth: 803, monsters: false, items: false });
    w.runes.add(w.dungeonGraph.runeBranches[0]);
    w.runes.add(w.dungeonGraph.runeBranches[1]);
    expect(w.over).toBe(false);
    expect(w.won).toBe(false);
    const objective = objectiveFor(w);
    expect(objective?.kind).toBe('orb');
    expect(objectiveFor(makeWorld({ seed: 2, depth: 802, monsters: false, items: false }))).toBeUndefined();
    clearObjective(w);
    expect(w.over).toBe(true);
    expect(w.won).toBe(true);
    expect(w.orbCollected).toBe(true);
    expect(w.events.filter((event) => event.type === 'orb')).toHaveLength(1);
    collectObjective(w);
    expect(w.events.filter((event) => event.type === 'orb')).toHaveLength(1);
  });

  it('does not allow an Orb victory without both runes even on Zot 3', () => {
    const w = makeWorld({ seed: 2, depth: 803, monsters: false, items: false });
    standOnObjective(w);
    collectObjective(w);
    expect(w.won).toBe(false);
    expect(w.orbCollected).toBe(false);
  });
});
