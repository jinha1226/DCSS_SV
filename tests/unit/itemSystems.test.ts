import { describe, expect, it } from 'vitest';
import { makeWorld } from '../../src/sim/world';
import { addConsumable, useConsumable } from '../../src/sim/consumables';
import { itemDisplayName } from '../../src/sim/identification';
import { ITEM_DEFINITIONS } from '../../src/data/itemCatalog';
import { populateFloorItems } from '../../src/sim/equipment';

describe('identification and enchantment', () => {
  it('shares an unknown appearance for identical stacks and reveals on use', () => {
    const w = makeWorld({ seed: 17, items: false, monsters: false });
    const before = itemDisplayName(w, 'potion_healing');
    expect(before).not.toBe('회복 물약');
    addConsumable(w, 'potion_healing', 2);
    w.hero.hp -= 40;
    expect(useConsumable(w, 'potion_healing')).toBe(true);
    expect(itemDisplayName(w, 'potion_healing')).toBe('회복 물약');
    expect(w.inventory.find((entry) => entry.kind === 'consumable' && entry.id === 'potion_healing')).toMatchObject({ count: 1 });
  });

  it('enchants the equipped weapon and prevents enhancing an artefact', () => {
    const w = makeWorld({ items: false, monsters: false });
    addConsumable(w, 'scroll_enchant_weapon');
    expect(useConsumable(w, 'scroll_enchant_weapon')).toBe(true);
    expect(w.weapon.enchantment).toBe(1);
    w.weapon = { ...w.weapon, special: true };
    addConsumable(w, 'scroll_enchant_weapon');
    expect(useConsumable(w, 'scroll_enchant_weapon')).toBe(false);
  });

  it('identification scroll reveals a different unknown consumable', () => {
    const w = makeWorld({ items: false, monsters: false });
    addConsumable(w, 'potion_magic');
    addConsumable(w, 'scroll_identify');
    expect(useConsumable(w, 'scroll_identify')).toBe(true);
    expect(w.identifiedItems.has('potion_magic')).toBe(true);
  });

  it('uses JSON depth weights to offer every enabled consumable', () => {
    const entries = ITEM_DEFINITIONS.filter((item) => item.enabled && ['potion', 'scroll', 'wand'].includes(item.kind));
    expect(entries.length).toBeGreaterThan(10);
    expect(entries.every((item) => item.depthWeights.some((weight) => weight > 0))).toBe(true);
    const w = makeWorld({ seed: 11, monsters: false });
    populateFloorItems(w);
    expect(w.groundItems.some((item) => item.kind === 'consumable')).toBe(true);
  });

  it('applies potion buffs and cures poison through shared effects', () => {
    const w = makeWorld({ items: false, monsters: false });
    addConsumable(w, 'potion_might');
    expect(useConsumable(w, 'potion_might')).toBe(true);
    expect(w.hero.might).toBeGreaterThan(0);
    w.hero.poison = 3;
    addConsumable(w, 'potion_curing');
    expect(useConsumable(w, 'potion_curing')).toBe(true);
    expect(w.hero.poison).toBe(0);
  });
});
