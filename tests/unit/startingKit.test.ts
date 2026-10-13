import { describe, expect, it } from 'vitest';
import { makeWorld } from '../../src/sim/world';

describe('DCSS starting kits', () => {
  it('dresses a berserker in animal skin', () => {
    const w = makeWorld({ monsters: false, items: false, job: 'berserker' });
    expect(w.gear.armour).toBe('animal_skin');
  });

  it('gives a fire mage a robe and a known potion of magic', () => {
    const w = makeWorld({ monsters: false, items: false, job: 'fire_mage' });
    expect(w.gear.armour).toBe('robe');
    expect(w.inventory.some((e) => e.kind === 'consumable' && e.id === 'potion_magic')).toBe(true);
    expect(w.identifiedItems.has('potion_magic')).toBe(true);
  });

  it('gives a spellblade leather armour and a scroll of blinking', () => {
    const w = makeWorld({ monsters: false, items: false, job: 'spellblade' });
    expect(w.gear.armour).toBe('leather_armour');
    expect(w.inventory.some((e) => e.kind === 'consumable' && e.id === 'scroll_blink')).toBe(true);
  });
  it('gives a fighter scale mail, buckler, might potions, and a hand axe', () => {
    const w = makeWorld({ monsters: false, items: false, job: 'fighter' });
    expect(w.gear.armour).toBe('scale_mail');
    expect(w.gear.offhand).toBe('buckler');
    expect(w.weapon.baseId).toBe('hand_axe');
    expect(w.inventory.some((e) => e.kind === 'consumable' && e.id === 'potion_might' && e.count === 2)).toBe(true);
  });
});
