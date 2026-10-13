import { describe, expect, it } from 'vitest';
import { heroEngaged } from '../../src/sim/engagement';
import { spawnMonster } from '../../src/sim/monster';
import { stepWorld } from '../../src/sim/world';
import { quietArena } from './arena';

describe('melee engagement', () => {
  it('slows walking only while an active melee monster is in reach', () => {
    const engaged = quietArena();
    const attacker = spawnMonster(engaged, 'goblin', 9, 10, true);
    attacker.rest = 10;
    expect(heroEngaged(engaged)).toBe(true);
    stepWorld(engaged, { mx: 1, my: 0 }, 0.1);

    const clear = quietArena();
    stepWorld(clear, { mx: 1, my: 0 }, 0.1);
    expect(engaged.hero.x - 10).toBeCloseTo((clear.hero.x - 10) * 0.7);

    attacker.x = 20;
    expect(heroEngaged(engaged)).toBe(false);
    attacker.x = 9;
    attacker.stun = 1;
    expect(heroEngaged(engaged)).toBe(false);
  });
});
