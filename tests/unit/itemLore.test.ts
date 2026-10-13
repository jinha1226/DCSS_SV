import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS } from '../../src/data/itemCatalog';
import { effectLines, itemLore } from '../../src/data/itemLore';

describe('DCSS item descriptions', () => {
  it('has a description for every item a hero can carry or wield', () => {
    const kinds = new Set([
      'weapon',
      'staff',
      'rod',
      'spellbook',
      'potion',
      'scroll',
      'wand',
      'jewellery',
      'armour',
      'shield',
      'throw',
      'missile',
    ]);
    const missing = ITEM_DEFINITIONS.filter((item) => kinds.has(item.kind) && !itemLore(item.id)).map((item) => item.id);
    expect(missing).toEqual([]);
  });

  it('shares one description across the tiers of a school', () => {
    expect(itemLore('staff_fire_2')).toBe(itemLore('staff_fire_0'));
    expect(itemLore('spellbook_ice_1')).toContain('냉기');
  });

  it('spells out what an item does with its numbers', () => {
    expect(effectLines('potion_healing')).toEqual(['체력을 30 회복한다.']);
    expect(effectLines('chain_mail')).toEqual(['방어 +4']);
    expect(effectLines('not_an_item')).toEqual([]);
  });
});
