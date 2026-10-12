import { describe, expect, it } from 'vitest';
import { spawnMonster } from '../../src/sim/monster';
import { styleOf } from '../../src/view/elementStyle';
import { monsterStatuses } from '../../src/view/statusIcons';
import { arena } from './arena';

describe('monster status icons', () => {
  it('lists every active affliction in a fixed order and nothing for a healthy monster', () => {
    const w = arena();
    const m = spawnMonster(w, 'goblin', 12, 10, true);
    expect(monsterStatuses(m)).toEqual([]);
    m.poison = 1;
    m.stun = 1;
    m.slow = 1;
    m.rot = 1;
    expect(monsterStatuses(m)).toEqual(['stun', 'slow', 'poison', 'rot']);
    m.stun = 0;
    expect(monsterStatuses(m)).not.toContain('stun');
  });
});

describe('element style of spells', () => {
  it('follows the damage element first, then the school', () => {
    expect(styleOf('ember_dart')).toBe('fire');
    expect(styleOf('split_lance')).toBe('ice');
    expect(styleOf('chain_lightning')).toBe('lightning');
    expect(styleOf('sling_stone')).toBe('earth');
    expect(styleOf('venom_dart')).toBe('poison');
    expect(styleOf('bone_lance')).toBe('death');
    expect(styleOf('hex_needle')).toBe('hex');
    expect(styleOf('spirit_dart')).toBe('spirit');
  });
});
