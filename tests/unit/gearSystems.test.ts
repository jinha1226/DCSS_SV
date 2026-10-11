import { describe, expect, it } from 'vitest';
import { makeWorld } from '../../src/sim/world';
import { equipGear, unequipGear, gearBonus, enchantArmour } from '../../src/sim/gear';
import { addConsumable, useConsumable } from '../../src/sim/consumables';
import { spawnMonster, thinkMonster } from '../../src/sim/monster';

describe('equippable gear and status', () => {
  it('equips armour, applies defence, enchants and unequips', () => {
    const w = makeWorld({ monsters: false, items: false });
    w.inventory.push({ kind: 'gear', uid: 'armour-test', id: 'leather_armour' });
    expect(equipGear(w, 'armour-test')).toBe(true);
    expect(gearBonus(w, 'armour')).toBe(2);
    addConsumable(w, 'scroll_enchant_armour');
    expect(useConsumable(w, 'scroll_enchant_armour')).toBe(true);
    expect(gearBonus(w, 'armour')).toBe(3);
    expect(unequipGear(w, 'armour')).toBe(true);
    expect(gearBonus(w, 'armour')).toBe(0);
  });

  it('blocks cursed gear removal until curse is lifted', () => {
    const w = makeWorld({ monsters: false, items: false });
    w.inventory.push({ kind: 'gear', uid: 'cursed', id: 'ring_warding' });
    expect(equipGear(w, 'cursed')).toBe(true);
    w.cursedGear.add('ring_warding');
    expect(unequipGear(w, 'ring1')).toBe(false);
    addConsumable(w, 'scroll_remove_curse');
    expect(useConsumable(w, 'scroll_remove_curse')).toBe(true);
    expect(unequipGear(w, 'ring1')).toBe(true);
  });

  it('fear causes a monster to flee rather than attack', () => {
    const w = makeWorld({ monsters: false, items: false });
    const m = spawnMonster(w, 'rat', w.hero.x + 1.4, w.hero.y, true);
    m.fear = 2;
    const stride = thinkMonster(w, m, 0.1);
    expect(stride.vx).toBeLessThan(0);
  });

  it('does not enchant unequipped gear', () => {
    const w = makeWorld({ monsters: false, items: false });
    expect(enchantArmour(w, 'leather_armour')).toBe(false);
  });
});
