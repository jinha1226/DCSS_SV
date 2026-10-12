import { describe, expect, it } from 'vitest';
import { buyOffer, populateBranchLoot, shopAccessible, shopLocation } from '../../src/sim/branchLoot';
import { collectGround } from '../../src/sim/equipment';
import { makeWorld, stepWorld } from '../../src/sim/world';

const STILL = { mx: 0, my: 0 };

describe('stage 6: optional Orc shop and Vaults rewards', () => {
  it('only grants branch caches in their respective branches', () => {
    for (const depth of [201, 202, 203]) {
      const w = makeWorld({ seed: 17, depth, monsters: false });
      expect(w.groundItems.filter((item) => item.kind === 'gold')).toHaveLength(2);
      expect(w.groundItems.filter((item) => item.kind === 'gold').every((item) => (item.count ?? 0) >= 25)).toBe(true);
    }
    for (const depth of [701, 702, 703]) {
      const w = makeWorld({ seed: 17, depth, monsters: false });
      expect(w.groundItems.some((item) => item.kind === 'axe' && (item.axe?.enchantment ?? 0) >= 1)).toBe(true);
      expect(w.groundItems.some((item) => item.kind === 'gear')).toBe(true);
    }
    const dungeon = makeWorld({ seed: 17, depth: 7, monsters: false });
    expect(dungeon.groundItems.some((item) => item.kind === 'gold')).toBe(false);
  });

  it('offers deterministic finite shop stock, with no reroll or restock', () => {
    const a = makeWorld({ seed: 17, depth: 203, monsters: false });
    const b = makeWorld({ seed: 17, depth: 203, monsters: false });
    expect(a.shopStock).toEqual(b.shopStock);
    expect(a.shopStock).toHaveLength(3);
    const before = [...a.shopStock];
    populateBranchLoot(a);
    expect(a.shopStock).toEqual(before);
  });

  it('requires proximity, funds, and single purchase, without currency duplication', () => {
    const w = makeWorld({ seed: 17, depth: 203, monsters: false });
    const first = w.shopStock[0]!;
    expect(buyOffer(w, first.uid)).toBe(false);
    w.gold = 500;
    expect(buyOffer(w, first.uid)).toBe(false);
    const shop = shopLocation(w)!;
    w.hero.x = shop.x;
    w.hero.y = shop.y;
    expect(shopAccessible(w)).toBe(true);
    const count = w.inventory.length;
    expect(buyOffer(w, first.uid)).toBe(true);
    expect(w.gold).toBe(500 - first.price);
    expect(w.inventory.length).toBe(count + 1);
    expect(buyOffer(w, first.uid)).toBe(false);
    expect(w.inventory.length).toBe(count + 1);
    w.choosing = [];
    expect(buyOffer(w, w.shopStock[0]!.uid)).toBe(false);
  });

  it('collects gold once, and does not replenish it on stepping again', () => {
    const w = makeWorld({ seed: 17, depth: 201, monsters: false });
    const gold = w.groundItems.find((item) => item.kind === 'gold')!;
    w.hero.x = gold.x;
    w.hero.y = gold.y;
    const value = gold.count!;
    collectGround(w);
    expect(w.gold).toBe(value);
    expect(w.groundItems.some((item) => item.uid === gold.uid)).toBe(false);
    collectGround(w);
    expect(w.gold).toBe(value);
  });

  it('keeps optional rewards out of a main-path run and does not create passive income', () => {
    const w = makeWorld({ seed: 17, depth: 9, monsters: false });
    expect(w.gold).toBe(0);
    expect(w.shopStock).toHaveLength(0);
    stepWorld(w, STILL, 1);
    expect(w.gold).toBe(0);
  });
});
