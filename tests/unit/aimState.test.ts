import { describe, expect, it } from 'vitest';
import { aimConfirm, aimDrag, aimHover, aimPress, aimRelease, startAim } from '../../src/app/aimState';
import { spellData } from '../../src/data/spells';
import { throwCandidates } from '../../src/sim/combat';
import { spawnMonster } from '../../src/sim/monster';
import { spellCandidates } from '../../src/sim/spells';
import { arena } from './arena';

describe('aim state', () => {
  it('starts throw aiming focused on the first ranked candidate', () => {
    const w = arena();
    spawnMonster(w, 'goblin', 14, 10, true);
    spawnMonster(w, 'goblin', 12, 10, true);

    const state = startAim(w, { kind: 'throw' });

    expect(state.focus).toBe(throwCandidates(w)[0]);
  });

  it('drags focus to another monster and releases at that monster', () => {
    const w = arena();
    const first = spawnMonster(w, 'goblin', 12, 10, true);
    const second = spawnMonster(w, 'goblin', 10, 5, true);
    const pressed = aimPress(w, startAim(w, { kind: 'throw' }), first);
    const dragged = aimDrag(w, pressed, second);

    expect(dragged.focus).toBe(second);
    expect(aimRelease(w, dragged)).toEqual({ throwAt: { x: second.x, y: second.y } });
  });

  it('clears focus after dragging to empty floor and releases toward that point', () => {
    const w = arena();
    const target = spawnMonster(w, 'goblin', 13, 10, true);
    const point = { x: 16, y: 16 };
    const pressed = aimPress(w, startAim(w, { kind: 'throw' }), target);
    const state = aimDrag(w, pressed, point);

    expect(state.focus).toBeUndefined();
    expect(aimRelease(w, state)).toEqual({ throwAt: point });
  });

  it('does not release a targeted spell over empty floor', () => {
    const w = arena();
    spawnMonster(w, 'goblin', 13, 10, true);
    const started = startAim(w, { kind: 'spell', id: 'focus_ray' });
    const pressed = aimPress(w, started, { x: 18, y: 18 });

    expect(started.focus).toBe(spellCandidates(w, spellData('focus_ray'))[0]);
    expect(aimRelease(w, pressed)).toBeUndefined();
    expect(pressed.aim).toBe(started.aim);
    expect(pressed.focus).toBeUndefined();
  });

  it('uses the screen-picked monster for focus and release', () => {
    const w = arena();
    const target = spawnMonster(w, 'goblin', 13, 10, true);
    const behind = { x: 13, y: 8 };
    const pressed = aimPress(w, startAim(w, { kind: 'throw' }), behind, target);

    expect(pressed.focus).toBe(target);
    expect(aimRelease(w, pressed)).toEqual({ throwAt: { x: target.x, y: target.y } });
  });

  it('confirms the focused throw target and falls back to automatic throwing without one', () => {
    const w = arena();
    const target = spawnMonster(w, 'goblin', 13, 10, true);

    expect(aimConfirm(w, startAim(w, { kind: 'throw' }))).toEqual({ throwAt: { x: target.x, y: target.y } });

    target.hp = 0;
    expect(aimConfirm(w, startAim(w, { kind: 'throw' }))).toEqual({ throw: true });
  });

  it('keeps the current focus when hovering away from every candidate', () => {
    const w = arena();
    const target = spawnMonster(w, 'goblin', 13, 10, true);
    const state = aimHover(w, startAim(w, { kind: 'throw' }), { x: 18, y: 18 });

    expect(state.focus).toBe(target);
  });
});
