import { describe, expect, it } from 'vitest';
import { facingIndex } from '../../src/view/heroSprite';

describe('the hero sprite facing', () => {
  it('follows the sheet columns S, SE, E, NE, N, NW, W, SW (screen y grows downward)', () => {
    expect(facingIndex(0, 1)).toBe(0);
    expect(facingIndex(1, 1)).toBe(1);
    expect(facingIndex(1, 0)).toBe(2);
    expect(facingIndex(1, -1)).toBe(3);
    expect(facingIndex(0, -1)).toBe(4);
    expect(facingIndex(-1, -1)).toBe(5);
    expect(facingIndex(-1, 0)).toBe(6);
    expect(facingIndex(-1, 1)).toBe(7);
  });

  it('rounds to the nearest of the eight', () => {
    expect(facingIndex(1, 0.3)).toBe(2);
    expect(facingIndex(1, 0.6)).toBe(1);
  });
});
