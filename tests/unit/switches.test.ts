import { describe, expect, it } from 'vitest';
import { readSwitches, writeSwitches } from '../../src/app/switches';
import { keyPush } from '../../src/input/keys';
import { STICK_REACH, stickPush } from '../../src/input/stick';
import { cellPixels } from '../../src/view/render';

describe('the address switches', () => {
  const usual = { cols: 17, speed: 6.5, look: 'dcss', seed: 0, debug: false, floor: 1, who: '' };

  it('fall back to the usual values', () => {
    expect(readSwitches('')).toEqual(usual);
    expect(readSwitches('?zoom=abc&look=neon&seed=-4&speed=fast')).toEqual(usual);
    expect(readSwitches('?zoom=3').cols).toBe(17);
    expect(readSwitches('?zoom=99').cols).toBe(17);
    expect(readSwitches('?speed=0').speed).toBe(6.5);
    expect(readSwitches('?speed=').speed).toBe(6.5);
  });

  it('read what is given', () => {
    expect(readSwitches('?zoom=15&speed=5.5&look=bright&seed=42&debug')).toEqual({
      cols: 17,
      speed: 5.5,
      look: 'bright',
      seed: 42,
      debug: true,
      floor: 1,
      who: '',
    });
  });

  it('write back only what differs from the usual', () => {
    expect(writeSwitches(readSwitches(''))).toBe('');
    expect(writeSwitches(readSwitches('?zoom=15'))).toBe('');
    expect(readSwitches('?floor=2').floor).toBe(2);
    expect(readSwitches('?who=minotaur-berserker').who).toBe('minotaur-berserker');
    expect(writeSwitches(readSwitches('?who=minotaur-berserker'))).toBe('?who=minotaur-berserker');
    expect(readSwitches('?zoom=9').cols).toBe(17);
    expect(readSwitches('?floor=4').floor).toBe(1);
    expect(writeSwitches(readSwitches('?floor=3'))).toBe('?floor=3');
    expect(writeSwitches(readSwitches('?zoom=17&speed=6.5'))).toBe('');
    for (const text of ['?zoom=13&speed=3.5&look=bright&seed=42&debug', '?debug', '?look=bright']) {
      expect(readSwitches(writeSwitches(readSwitches(text)))).toEqual(readSwitches(text));
    }
  });
});

describe('the size of a cell', () => {
  it('is a whole number of pixels', () => {
    expect(cellPixels(1170, 15)).toBe(78);
    expect(cellPixels(1170, 17)).toBe(69);
    expect(Number.isInteger(cellPixels(783, 15))).toBe(true);
  });
});

describe('the stick', () => {
  it('reads as still near its middle', () => {
    expect(stickPush(0, 0)).toEqual({ x: 0, y: 0 });
    expect(stickPush(3, -3)).toEqual({ x: 0, y: 0 });
  });

  it('pushes fully at its reach and no harder beyond it', () => {
    expect(stickPush(STICK_REACH, 0).x).toBeCloseTo(1);
    expect(stickPush(STICK_REACH * 3, 0).x).toBeCloseTo(1);
    const diagonal = stickPush(-STICK_REACH, STICK_REACH);
    expect(Math.hypot(diagonal.x, diagonal.y)).toBeCloseTo(1);
    expect(diagonal.x).toBeLessThan(0);
    expect(diagonal.y).toBeGreaterThan(0);
  });

  it('pushes part way in between, growing with the pull', () => {
    const a = stickPush(STICK_REACH * 0.4, 0).x;
    const b = stickPush(STICK_REACH * 0.7, 0).x;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(1);
  });
});

describe('the keys', () => {
  it('give a direction from where they sit on the board', () => {
    expect(keyPush(new Set())).toEqual({ x: 0, y: 0 });
    expect(keyPush(new Set(['KeyW', 'KeyD']))).toEqual({ x: 1, y: -1 });
    expect(keyPush(new Set(['ArrowLeft', 'ArrowDown']))).toEqual({ x: -1, y: 1 });
  });

  it('cancel out when opposite keys are held', () => {
    expect(keyPush(new Set(['KeyA', 'ArrowRight', 'KeyS']))).toEqual({ x: 0, y: 1 });
  });
});
