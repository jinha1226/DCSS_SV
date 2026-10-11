import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS, ITEM_KINDS, itemDefinition, parseItemDefinition, validateItemDefinitions } from '../../src/data/itemCatalog';

describe('extensible item definitions', () => {
  it('recognizes old weapons and new inactive item categories', () => {
    expect(itemDefinition('hand_axe')).toMatchObject({ kind: 'weapon', enabled: true, useMode: 'equip' });
    expect(itemDefinition('potion_healing')).toMatchObject({ kind: 'potion', enabled: false, useMode: 'store' });
    expect(itemDefinition('scroll_blink').effects[0]).toMatchObject({ id: 'blink', power: 3 });
    for (const kind of ['wand', 'jewellery', 'armour', 'shield']) expect(ITEM_KINDS).toContain(kind);
    expect(ITEM_DEFINITIONS.some((item) => item.kind === 'potion' && item.enabled)).toBe(false);
    expect(() => validateItemDefinitions()).not.toThrow();
  });

  it('accepts new types with a shared schema, without modifying the weapon parser', () => {
    const item = parseItemDefinition({
      id: 'test_scroll',
      kind: 'scroll',
      name: '시험 두루마리',
      enabled: false,
      useMode: 'on_step',
      effects: [{ id: 'fog', duration: 2, radius: 3 }],
    });
    expect(item).toMatchObject({ kind: 'scroll', useMode: 'on_step', maxStack: 9 });
  });

  it('rejects unknown types, invalid effects, and premature activation', () => {
    const base = { id: 'draft', kind: 'potion', name: '임시 물약', enabled: false };
    expect(() => parseItemDefinition({ ...base, kind: 'unknown' })).toThrow();
    expect(() => parseItemDefinition({ ...base, effects: [{ id: 'heal', power: 'high' }] })).toThrow();
    expect(() => parseItemDefinition({ ...base, enabled: true })).toThrow();
    expect(() => parseItemDefinition({ ...base, depthWeights: [1, 0, 0] })).toThrow();
  });
});
