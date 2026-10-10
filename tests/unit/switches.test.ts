import { describe, expect, it } from 'vitest';
import { readSwitches, writeSwitches } from '../../src/app/switches';
import { cellPixels } from '../../src/view/render';

describe('the address switches', () => {
  it('fall back to the usual values', () => {
    expect(readSwitches('')).toEqual({ cols: 13, look: 'dcss', seed: 0, debug: false });
    expect(readSwitches('?zoom=abc&look=neon&seed=-4')).toEqual({ cols: 13, look: 'dcss', seed: 0, debug: false });
    expect(readSwitches('?zoom=3').cols).toBe(13);
    expect(readSwitches('?zoom=99').cols).toBe(13);
  });

  it('read what is given', () => {
    expect(readSwitches('?zoom=17&look=bright&seed=42&debug')).toEqual({ cols: 17, look: 'bright', seed: 42, debug: true });
  });

  it('write back only what differs from the usual', () => {
    expect(writeSwitches(readSwitches(''))).toBe('');
    expect(writeSwitches(readSwitches('?zoom=17'))).toBe('?zoom=17');
    for (const text of ['?zoom=17&look=bright&seed=42&debug', '?debug', '?look=bright']) {
      expect(readSwitches(writeSwitches(readSwitches(text)))).toEqual(readSwitches(text));
    }
  });
});

describe('the size of a cell', () => {
  it('is a whole number of pixels', () => {
    expect(cellPixels(1170, 13)).toBe(90);
    expect(cellPixels(1170, 17)).toBe(69);
    expect(Number.isInteger(cellPixels(783, 13))).toBe(true);
  });
});
