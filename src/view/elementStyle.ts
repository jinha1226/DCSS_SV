import { spellData } from '../data/spells';

/** How a spell looks on screen: the element's movement, not just its colour. */
export type ElementStyle = 'fire' | 'ice' | 'lightning' | 'earth' | 'poison' | 'death' | 'hex' | 'spirit';

export interface Palette {
  /** Hottest or brightest part. */
  readonly core: string;
  readonly main: string;
  /** Where it fades to (smoke, mist, dust). */
  readonly fade: string;
}

export const PALETTES: Readonly<Record<ElementStyle, Palette>> = {
  fire: { core: '#fff3b0', main: '#f08a32', fade: '#5a4a44' },
  ice: { core: '#ffffff', main: '#9fdcf5', fade: '#d9eef7' },
  lightning: { core: '#ffffff', main: '#b9d4ff', fade: '#6f8fd8' },
  earth: { core: '#d9c3a0', main: '#8a6a48', fade: '#a39278' },
  poison: { core: '#e4ffb0', main: '#7fc24a', fade: '#3f6b2c' },
  death: { core: '#e9d8ff', main: '#7a4fb0', fade: '#26182f' },
  hex: { core: '#f1e6ff', main: '#a98ef0', fade: '#4d3f7a' },
  spirit: { core: '#fff8d8', main: '#f0d28a', fade: '#9b8650' },
};

const SCHOOL_STYLE: Readonly<Record<string, ElementStyle>> = {
  fire: 'fire',
  ice: 'ice',
  air: 'lightning',
  earth: 'earth',
  summoning: 'spirit',
  hexes: 'hex',
  necromancy: 'death',
};

const cache = new Map<string, ElementStyle>();

/** The style follows the damage element first (poison darts look like poison), then the school. */
export function styleOf(spellId: string | undefined): ElementStyle {
  if (!spellId) return 'hex';
  const known = cache.get(spellId);
  if (known) return known;
  const spell = spellData(spellId);
  const style: ElementStyle =
    spell.element === 'poison' ? 'poison' : spell.element === 'negative' ? 'death' : (SCHOOL_STYLE[spell.school] ?? 'hex');
  cache.set(spellId, style);
  return style;
}

/** Mixes two #rrggbb colours; t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (shift: number): number => Math.round(((pa >> shift) & 255) * (1 - k) + ((pb >> shift) & 255) * k);
  return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
}
