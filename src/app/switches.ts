import { LOOKS, type LookName } from '../view/look';

/** What the address line can turn on. */
export interface Switches {
  /** How many cells fit across the screen. */
  cols: number;
  /** Which floor and wall tiles a floor is drawn with. */
  look: LookName;
  /** The seed of the run; 0 means "pick one". */
  seed: number;
  debug: boolean;
}

export const COLS = { min: 9, max: 25, normal: 13 } as const;

export function readSwitches(search: string): Switches {
  const q = new URLSearchParams(search);
  const cols = Math.round(Number(q.get('zoom')));
  const look = q.get('look');
  const seed = Number(q.get('seed'));
  return {
    cols: Number.isFinite(cols) && cols >= COLS.min && cols <= COLS.max ? cols : COLS.normal,
    look: (LOOKS as readonly string[]).includes(look ?? '') ? (look as LookName) : 'dcss',
    seed: Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : 0,
    debug: q.has('debug'),
  };
}

/** The address line that gives these switches back; what is at its usual value is left out. */
export function writeSwitches(s: Switches): string {
  const q = new URLSearchParams();
  if (s.cols !== COLS.normal) q.set('zoom', String(s.cols));
  if (s.look !== 'dcss') q.set('look', s.look);
  if (s.seed) q.set('seed', String(s.seed));
  const text = q.toString() + (s.debug ? (q.size ? '&debug' : 'debug') : '');
  return text ? `?${text}` : '';
}
