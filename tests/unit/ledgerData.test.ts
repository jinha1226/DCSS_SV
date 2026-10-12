import { describe, expect, it } from 'vitest';
import { makeWorld } from '../../src/sim/world';
import { bagGroups, equipmentRows, poolTone, resistPips } from '../../src/ui/ledgerData';

describe('the ledger', () => {
  const fresh = () => makeWorld({ species: 'minotaur', job: 'berserker', seed: 3, speed: 6.5, depth: 1 });

  it('colours pools like DCSS: green, yellow, then red', () => {
    expect(poolTone(60, 60)).toBe('good');
    expect(poolTone(30, 60)).toBe('warn');
    expect(poolTone(10, 60)).toBe('bad');
    expect(poolTone(0, 0)).toBe('bad');
  });

  it('shows resistances as three pips', () => {
    for (const r of resistPips(fresh())) expect(r.pips.split(' ')).toHaveLength(3);
  });

  it('letters the ten worn slots a to j', () => {
    expect(
      equipmentRows(fresh())
        .map((r) => r.letter)
        .join(''),
    ).toBe('abcdefghij');
  });

  it('groups the bag by kind and letters it straight through', () => {
    const w = fresh();
    w.inventory.push({ uid: 'p', kind: 'consumable', id: 'potion_healing', count: 2 });
    w.inventory.push({ uid: 'g', kind: 'gear', id: 'leather_armour' });
    const groups = bagGroups(w);
    expect(groups.map((g) => g.title)).toEqual(['무기', '방어구 · 장신구', '소모품']);
    const letters = groups.flatMap((g) => g.rows.map((r) => r.letter));
    expect(letters.slice(0, 3)).toEqual(['a', 'b', 'c']);
    const potion = groups.flatMap((g) => g.rows).find((r) => r.key === 'p');
    expect(potion?.note).toBe('×2');
    expect(potion?.tone).toBe('cyan');
  });
});
