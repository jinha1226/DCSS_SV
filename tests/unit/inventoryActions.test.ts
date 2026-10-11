import { describe, expect, it } from 'vitest';
import { makeWorld } from '../../src/sim/world';
import { addConsumable, useConsumable } from '../../src/sim/consumables';
import { equipStoredWeapon, storePickup } from '../../src/sim/equipment';
import { plainWeapon } from '../../src/data/items';

describe('bag equipment and consumable actions', () => {
  it('stores found weapons and swaps them with the equipped weapon', () => {
    const w = makeWorld({ items: false, monsters: false });
    const old = w.weapon;
    const found = plainWeapon('battle_axe', 'bag-test');
    const pickup = { uid: found.uid, kind: 'axe' as const, x: w.hero.x, y: w.hero.y, axe: found, ignored: false };
    w.groundItems.push(pickup);
    w.pendingPickup = pickup;
    storePickup(w);
    expect(w.pendingPickup).toBeNull();
    expect(w.weapon.uid).toBe(old.uid);
    expect(w.inventory).toHaveLength(1);
    expect(equipStoredWeapon(w, found.uid)).toBe(true);
    expect(w.weapon.uid).toBe(found.uid);
    expect(w.inventory[0]).toMatchObject({ uid: old.uid });
  });

  it('does not waste a healing potion at full health and consumes it after injury', () => {
    const w = makeWorld({ items: false, monsters: false });
    addConsumable(w, 'potion_healing', 2);
    expect(useConsumable(w, 'potion_healing')).toBe(false);
    w.hero.hp -= 10;
    expect(useConsumable(w, 'potion_healing')).toBe(true);
    expect(w.hero.hp).toBe(w.hero.maxHp);
    expect(w.inventory[0]).toMatchObject({ count: 1 });
  });

  it('does not spend a wand charge without a visible target', () => {
    const w = makeWorld({ items: false, monsters: false });
    addConsumable(w, 'wand_sparks');
    expect(useConsumable(w, 'wand_sparks')).toBe(false);
    expect(w.inventory[0]).toMatchObject({ count: 1 });
  });
});
