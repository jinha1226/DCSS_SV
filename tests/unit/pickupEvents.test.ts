import { describe, expect, it } from 'vitest';
import { collectGround } from '../../src/sim/equipment';
import { arena } from './arena';

describe('pickup events', () => {
  it('reports gold and consumables taken off the floor', () => {
    const w = arena();
    const at = { x: w.hero.x, y: w.hero.y };
    w.groundItems.push({ uid: 'g1', kind: 'gold', ...at, count: 7, ignored: false });
    w.groundItems.push({ uid: 'c1', kind: 'consumable', itemId: 'potion_healing', ...at, count: 1, ignored: false });
    w.events.length = 0;
    collectGround(w);
    const pickups = w.events.filter((e) => e.type === 'pickup');
    expect(pickups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ item: 'gold', count: 7 }),
        expect.objectContaining({ item: 'consumable', id: 'potion_healing', count: 1 }),
      ]),
    );
  });
});
