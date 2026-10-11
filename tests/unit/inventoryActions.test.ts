import { describe, expect, it } from 'vitest';
import { makeWorld } from '../../src/sim/world';
import { addConsumable, dropConsumable, useConsumable } from '../../src/sim/consumables';
import { dropStoredWeapon, equipStoredWeapon } from '../../src/sim/equipment';

describe('inventory actions', () => {
  it('stacks consumables, drops one and retrieves its full count', () => {
    const w = makeWorld({ items: false, monsters: false });
    addConsumable(w, 'potion_healing', 3);
    expect(dropConsumable(w, 'potion_healing')).toBe(true);
    expect(w.inventory.find((item) => item.kind === 'consumable')?.count).toBe(2);
    const ground = w.groundItems.at(-1)!;
    expect(ground.itemId).toBe('potion_healing');
    expect(ground.ignored).toBe(true);
    expect(ground.count).toBe(1);
  });

  it('consumes only when an effect can be applied', () => {
    const w = makeWorld({ items: false, monsters: false });
    addConsumable(w, 'potion_healing', 2);
    expect(useConsumable(w, 'potion_healing')).toBe(false);
    w.hero.hp -= 40;
    expect(useConsumable(w, 'potion_healing')).toBe(true);
    expect(w.inventory.find((item) => item.kind === 'consumable')?.count).toBe(1);
    expect(w.hero.hp).toBe(w.hero.maxHp - 10);
  });

  it('equips a stored weapon by swapping with the active one and allows dropping it', () => {
    const w = makeWorld({ items: false, monsters: false });
    const first = w.weapon;
    const second = { ...first, uid: 'spare', name: '예비 무기' };
    w.inventory.push({ kind: 'weapon', uid: second.uid, weapon: second });
    expect(equipStoredWeapon(w, 'spare')).toBe(true);
    expect(w.weapon.uid).toBe('spare');
    expect(w.inventory[0]?.uid).toBe(first.uid);
    expect(dropStoredWeapon(w, first.uid)).toBe(true);
    expect(w.inventory).toHaveLength(0);
    expect(w.groundItems.at(-1)?.ignored).toBe(true);
  });
});
