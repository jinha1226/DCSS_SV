import { describe, expect, it } from 'vitest';
import { bleeds, corpsify, leavesCorpse, type Pixels } from '../../src/view/corpse';

/** A 32x32 tile with a solid grey figure in rows 4..27, columns 10..21. */
function figure(): Pixels {
  const size = 32;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 4; y < 28; y++) for (let x = 10; x < 22; x++) data.set([150, 150, 150, 255], (y * size + x) * 4);
  return { data, size };
}

const at = (p: Pixels, x: number, y: number): number[] => Array.from(p.data.slice((y * p.size + x) * 4, (y * p.size + x) * 4 + 4));

describe('DCSS corpsify', () => {
  it('squashes the figure flat around the middle of the tile', () => {
    const out = corpsify(figure());
    const rows = new Set<number>();
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (at(out, x, y)[0] === 150) rows.add(y);
    expect(Math.min(...rows)).toBeGreaterThanOrEqual(8);
    expect(Math.max(...rows)).toBeLessThanOrEqual(26);
  });

  it('cuts it at the waist, leaves a gap and colours the wound red', () => {
    const out = corpsify(figure());
    // The cut sits at rows 15..18 by the centre column: two of them are wound, the rest bare floor.
    const column = [15, 16, 17, 18].map((y) => at(out, 16, y));
    expect(column.some((px) => px[0] === 110 && px[1] === 0 && px[3] === 255)).toBe(true);
    expect(column.some((px) => px[3] === 0)).toBe(true);
  });

  it('pulls the halves apart sideways, the top half to the left', () => {
    const out = corpsify(figure());
    const leftmost = (y: number): number => [...Array(32).keys()].find((x) => at(out, x, y)[0] === 150) ?? -1;
    expect(leftmost(22) - leftmost(10)).toBe(6);
  });

  it('casts a black diagonal shadow', () => {
    const out = corpsify(figure());
    let shadow = 0;
    for (let i = 0; i < out.data.length; i += 4) if (out.data[i + 3] === 255 && out.data[i] === 0 && out.data[i + 1] === 0) shadow++;
    expect(shadow).toBeGreaterThan(0);
  });

  it('knows the undead neither bleed nor leave a corpse', () => {
    expect(bleeds('goblin')).toBe(true);
    expect(leavesCorpse('goblin')).toBe(true);
    expect(bleeds('bog_body')).toBe(false);
    expect(leavesCorpse('bog_body')).toBe(false);
  });
});
