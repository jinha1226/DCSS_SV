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
  /** A layered sprite set from public/sprites/ to draw the hero with, e.g. 'haven'; empty for the DCSS tile. */
  sprite: string;
  /** '3d' draws the world with three.js (the default); '2d' keeps the DCSS tile view. */
  renderer: '3d' | '2d';
  /** 'low' turns off bloom, shadows and antialiasing for weak phones. */
  quality: 'high' | 'low';
  /** 'tiles' stands DCSS tiles in the 3D world (the default); 'models' uses the rigged 3D figures. */
  figures: 'tiles' | 'models';
  /** 'tiles' builds Dungeon floors from DCSS tiles (the default); 'kaykit' keeps the 3D kit everywhere. */
  ground: 'tiles' | 'kaykit';
}

export const COLS = { min: 15, max: 15, normal: 15 } as const;
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
    renderer: query.get('r') === '2d' ? '2d' : '3d',
    quality: query.get('fx') === 'low' ? 'low' : 'high',
    figures: query.get('models') === '3d' ? 'models' : 'tiles',
    ground: query.get('ground') === 'kaykit' ? 'kaykit' : 'tiles',
    sprite: /^[a-z0-9_-]{1,32}$/.test(query.get('sprite') ?? '') ? (query.get('sprite') as string) : '',
  };
}

export function writeSwitches(switches: Switches): string {
  const query = new URLSearchParams();
  if (switches.speed !== SPEED.normal) query.set('speed', String(switches.speed));
  if (switches.look !== 'dcss') query.set('look', switches.look);
  if (switches.seed) query.set('seed', String(switches.seed));
  if (switches.floor !== 1) query.set('floor', String(switches.floor));
  if (switches.who) query.set('who', switches.who);
  if (switches.sprite) query.set('sprite', switches.sprite);
  if (switches.renderer === '2d') query.set('r', '2d');
  if (switches.quality === 'low') query.set('fx', 'low');
  if (switches.figures === 'models') query.set('models', '3d');
  if (switches.ground === 'kaykit') query.set('ground', 'kaykit');
  const text = query.toString() + (switches.debug ? (query.size ? '&debug' : 'debug') : '');
  return text ? '?' + text : '';
}
