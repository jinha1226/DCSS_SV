import { HERO } from '../data/hero';
import { LOOKS, type LookName } from '../view/look';

/** What the address line can turn on. */
export interface Switches {
  /** How many cells fit across the screen. */
  cols: number;
  /** Cells the hero walks in a second. */
  speed: number;
  /** Which floor and wall tiles a floor is drawn with. */
  look: LookName;
  /** The seed of the run; 0 means "pick one". */
  seed: number;
  debug: boolean;
}

/** Cells across the screen. */
export const COLS = { min: 9, max: 25, normal: 17 } as const;
export const SPEED = { min: 1, max: 12, normal: HERO.speed } as const;

function within(text: string | null, lo: number, hi: number, otherwise: number): number {
  const v = Number(text);
  return text !== null && text !== '' && Number.isFinite(v) && v >= lo && v <= hi ? v : otherwise;
}

export function readSwitches(search: string): Switches {
  const q = new URLSearchParams(search);
  const look = q.get('look');
  const seed = Number(q.get('seed'));
  return {
    cols: Math.round(within(q.get('zoom'), COLS.min, COLS.max, COLS.normal)),
    speed: within(q.get('speed'), SPEED.min, SPEED.max, SPEED.normal),
    look: (LOOKS as readonly string[]).includes(look ?? '') ? (look as LookName) : 'dcss',
    seed: Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : 0,
    debug: q.has('debug'),
  };
}

/** The address line that gives these switches back; what is at its usual value is left out. */
export function writeSwitches(s: Switches): string {
  const q = new URLSearchParams();
  if (s.cols !== COLS.normal) q.set('zoom', String(s.cols));
  if (s.speed !== SPEED.normal) q.set('speed', String(s.speed));
  if (s.look !== 'dcss') q.set('look', s.look);
  if (s.seed) q.set('seed', String(s.seed));
  const text = q.toString() + (s.debug ? (q.size ? '&debug' : 'debug') : '');
  return text ? `?${text}` : '';
}
