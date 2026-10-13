import { describe, expect, it } from 'vitest';
import { skillData } from '../../src/data/skills';
import { makeWorld } from '../../src/sim/world';
import { pickupParts, screenFromUnit, skillParts } from '../../src/ui/pickupToast';

describe('pickup and skill-up text', () => {
  const w = makeWorld({ monsters: false, items: false });

  it('colours only the gold amount', () => {
    expect(pickupParts(w, { type: 'pickup', x: 0, y: 0, item: 'gold', count: 12 }, 12)).toEqual([
      { text: '금화 ' },
      { text: '+12', tone: 'gold' },
    ]);
  });

  it('colours the item name and counts repeats after it', () => {
    expect(pickupParts(w, { type: 'pickup', x: 0, y: 0, item: 'ammo', count: 1 }, 1)).toEqual([{ text: '부메랑', tone: 'item' }]);
    expect(pickupParts(w, { type: 'pickup', x: 0, y: 0, item: 'ammo', count: 1 }, 3)).toEqual([
      { text: '부메랑', tone: 'item' },
      { text: ' ×3' },
    ]);
  });

  it('colours the skill and its new level', () => {
    expect(skillParts({ type: 'skill', id: 'axe', from: 2, level: 3 })).toEqual([
      { text: skillData('axe').name, tone: 'skill' },
      { text: ' 숙련 ' },
      { text: '3', tone: 'level' },
    ]);
  });

  it('turns a point on the canvas into page pixels', () => {
    expect(screenFromUnit(0.5, 0.25, { left: 10, top: 20, width: 400, height: 800 })).toEqual({ x: 210, y: 220 });
  });
});
