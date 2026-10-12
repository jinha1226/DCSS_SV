import { describe, expect, it } from 'vitest';
import { makeWorld } from '../../src/sim/world';
import { lootTier } from '../../src/sim/lootTier';

describe('location-based loot tier', () => {
  it('uses node difficulty instead of numeric node id', () => {
    const w = makeWorld({ seed: 42, monsters: false, items: false });
    for (const node of w.dungeonGraph.nodes.values()) {
      w.depth = node.id;
      const expected = node.difficulty <= 4 ? 0 : node.difficulty <= 10 ? 1 : 2;
      expect(lootTier(w)).toBe(expected);
    }
  });
});
