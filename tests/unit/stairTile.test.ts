import { describe, expect, it } from 'vitest';
import { makeWorld } from '../../src/sim/world';
import { stairTile } from '../../src/view/stairTile';

describe('stair tiles', () => {
  it('draws plain stone stairs on the first floor', () => {
    const w = makeWorld({ monsters: false, items: false });
    for (const s of w.stairs) expect(stairTile(w, s.x, s.y, s.down)).toMatch(/^feat\/stone_stairs_/);
  });

  it('draws the Lair gateway on the stair that leads into the Lair', () => {
    const w = makeWorld({ monsters: false, items: false, depth: 4 });
    const tiles = w.stairs.filter((s) => s.down).map((s) => stairTile(w, s.x, s.y, true));
    expect(tiles).toContain('dngn/gateways/enter_lair');
  });

  it('stands a free gateway in for entrances whose own tile may not be reused', () => {
    const downTiles = (seed: number, depth: number): string[] => {
      const w = makeWorld({ monsters: false, items: false, seed, depth });
      return w.stairs.filter((s) => s.down).map((s) => stairTile(w, s.x, s.y, true));
    };
    expect(downTiles(1, 3)).toContain('dcss/dngn/gateways/enter_depths');
    // Lair 2 leads on to Swamp or Shoals, depending on the seed.
    expect(downTiles(1, 102)).toContain('dcss/dngn/gateways/slimy_stairs_down');
    expect(downTiles(2, 102)).toContain('dcss/dngn/gateways/portal');
  });
});
