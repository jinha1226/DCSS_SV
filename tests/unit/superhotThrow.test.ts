import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../../src/data/packs';
import { throwAimTarget } from '../../src/sim/combat';
import { spawnMonster } from '../../src/sim/monster';
import { STEP, stepWorld } from '../../src/sim/world';
import { arena, quietArena, STILL } from './arena';

describe('superhot slow motion', () => {
  it('advances time and approaching monsters at the configured fraction', () => {
    const normal = quietArena();
    const slow = quietArena();
    const normalMonster = spawnMonster(normal, 'goblin', 15, 10, true);
    const slowMonster = spawnMonster(slow, 'goblin', 15, 10, true);

    for (let i = 0; i < 10; i++) {
      stepWorld(normal, STILL, STEP);
      stepWorld(slow, STILL, STEP * DUNGEON.superhotSlow);
    }

    const normalTravel = 15 - normalMonster.x;
    const slowTravel = 15 - slowMonster.x;
    expect(slow.time).toBeCloseTo(STEP * 10 * DUNGEON.superhotSlow, 8);
    expect(slowTravel / normalTravel).toBeCloseTo(DUNGEON.superhotSlow, 1);
  });
});

describe('aimed throwing', () => {
  it('aims the first shot at the monster selected by the point', () => {
    const w = arena();
    spawnMonster(w, 'goblin', 13, 10, true).stun = 99;
    const aimed = spawnMonster(w, 'goblin', 10, 5, true);
    aimed.stun = 99;

    stepWorld(w, { ...STILL, throwAt: { x: aimed.x, y: aimed.y } });

    expect(w.shots).toHaveLength(1);
    expect(w.shots[0]!.vy).toBeLessThan(0);
    expect(Math.abs(w.shots[0]!.vy)).toBeGreaterThan(Math.abs(w.shots[0]!.vx));
  });

  it('throws one shot toward empty floor and spends one ammo', () => {
    const w = arena();
    const ammo = w.ammo;
    spawnMonster(w, 'goblin', 10, 5, true).stun = 99;

    stepWorld(w, { ...STILL, throwAt: { x: 15, y: 10 } });

    expect(w.ammo).toBe(ammo - 1);
    expect(w.shots).toHaveLength(1);
    expect(w.shots[0]!.vx).toBeGreaterThan(0);
    expect(w.shots[0]!.vy).toBeCloseTo(0, 8);
  });

  it('keeps automatic throwing aimed at the ranked first target', () => {
    const w = arena();
    const target = spawnMonster(w, 'goblin', 10, 5, true);
    target.stun = 99;

    stepWorld(w, { ...STILL, throw: true });

    expect(w.shots).toHaveLength(1);
    expect(w.shots[0]!.vy).toBeLessThan(0);
    expect(Math.abs(w.shots[0]!.vy)).toBeGreaterThan(Math.abs(w.shots[0]!.vx));
  });

  it('ignores an aimed throw while cooling down', () => {
    const w = arena();
    const ammo = w.ammo;
    w.hero.throwing = 1;

    stepWorld(w, { ...STILL, throwAt: { x: 15, y: 10 } });

    expect(w.ammo).toBe(ammo);
    expect(w.shots).toHaveLength(0);
  });

  it('focuses the nearest candidate close enough to the pointer', () => {
    const w = arena();
    const first = spawnMonster(w, 'goblin', 13, 10, true);
    const second = spawnMonster(w, 'goblin', 13.7, 10, true);

    expect(throwAimTarget(w, 13.55, 10)).toBe(second);
    expect(throwAimTarget(w, 18, 18)).toBeUndefined();
    expect(throwAimTarget(w, first.x, first.y)).toBe(first);
  });
});
