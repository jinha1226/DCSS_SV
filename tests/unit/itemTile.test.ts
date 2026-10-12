import { describe, expect, it } from 'vitest';
import { hasTile } from '../../src/data/tiles';
import { identifyItem, itemTile } from '../../src/sim/identification';
import { makeWorld } from '../../src/sim/world';

describe('item tiles', () => {
  const w = makeWorld({ species: 'minotaur', job: 'berserker', seed: 7, speed: 6.5, depth: 1 });

  it('draw a potion as the flask its appearance names, before and after it is identified', () => {
    const look = w.itemAppearances['potion_healing'] ?? '';
    const before = itemTile(w, 'potion_healing');
    expect(before).toMatch(/^item\/potion\//);
    expect(hasTile(before!)).toBe(true);
    identifyItem(w, 'potion_healing');
    expect(itemTile(w, 'potion_healing')).toBe(before);
    expect(look).toMatch(/물약$/);
  });

  it('give different potions different flasks and every scroll the same scroll', () => {
    expect(itemTile(w, 'potion_healing')).not.toBe(itemTile(w, 'potion_magic'));
    expect(itemTile(w, 'scroll_blink')).toBe(itemTile(w, 'scroll_identify'));
  });

  it('keep the catalogue tile for gear', () => {
    expect(itemTile(w, 'leather_armour')).toBe('item/armour/leather_armour1');
  });
});
