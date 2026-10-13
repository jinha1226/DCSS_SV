import { describe, expect, it } from 'vitest';
import { bagEntries, equipmentSlots } from '../../src/ui/inventorySheets';
import { makeWorld } from '../../src/sim/world';

describe('equipment and bag presentation', () => {
  it("shows the real equipped weapon and the job's starting armour", () => {
    const w = makeWorld({ monsters: false, items: false });
    const slots = equipmentSlots(w);
    expect(slots.find((slot) => slot.id === 'weapon')?.value).toBe(w.weapon.name);
    expect(slots.find((slot) => slot.id === 'armour')).toMatchObject({ available: true, value: '짐승 가죽 갑옷' });
    expect(slots.filter((slot) => slot.available)).toHaveLength(10);
  });

  it('uses the same weapon in the equipment and bag views', () => {
    const w = makeWorld({ monsters: false, items: false });
    expect(bagEntries(w).find((entry) => entry.equipped)?.id).toBe(w.weapon.uid);
  });
});
