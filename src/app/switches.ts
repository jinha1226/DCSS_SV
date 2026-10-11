import { HERO } from '../data/hero';
import { LOOKS, type LookName } from '../view/look';

export interface Switches {
  cols: number;
  speed: number;
  look: LookName;
  seed: number;
  debug: boolean;
  floor: number;
  who: string;
}

export const COLS = { min: 17, max: 17, normal: 17 } as const;
export const SPEED = { min: 1, max: 12, normal: HERO.speed } as const;

function within(text: string | null, lo: number, hi: number, otherwise: number): number {
  const value = Number(text);
  return text !== null && text !== '' && Number.isFinite(value) && value >= lo && value <= hi ? value : otherwise;
}

export function readSwitches(search: string): Switches {
  const query = new URLSearchParams(search);
  const look = query.get('look');
  const seed = Number(query.get('seed'));
  return {
    cols: COLS.normal,
    speed: within(query.get('speed'), SPEED.min, SPEED.max, SPEED.normal),
    look: (LOOKS as readonly string[]).includes(look ?? '') ? (look as LookName) : 'dcss',
    seed: Number.isFinite(seed) && seed > 0 ? Math.floor(seed) : 0,
    debug: query.has('debug'),
    floor: Math.round(within(query.get('floor'), 1, 3, 1)),
    who: query.get('who') ?? '',
  };
}

export function writeSwitches(switches: Switches): string {
  const query = new URLSearchParams();
  if (switches.speed !== SPEED.normal) query.set('speed', String(switches.speed));
  if (switches.look !== 'dcss') query.set('look', switches.look);
  if (switches.seed) query.set('seed', String(switches.seed));
  if (switches.floor !== 1) query.set('floor', String(switches.floor));
  if (switches.who) query.set('who', switches.who);
  const text = query.toString() + (switches.debug ? (query.size ? '&debug' : 'debug') : '');
  return text ? '?' + text : '';
}
