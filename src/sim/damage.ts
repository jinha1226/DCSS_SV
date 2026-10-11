import type { ResistName } from '../data/items';

export type DamageType = 'physical' | ResistName;
export type Resistances = Readonly<Partial<Record<ResistName, number>>>;

/** Existing resistance scale: -1 = x2, 0 = x1, +1 = x0.5, +2 = x0.25, +3 = immune. */
export function resistanceFactor(level: number): number {
  if (level >= 3) return 0;
  if (level === -1) return 2;
  return Math.pow(0.5, Math.max(0, level));
}

/** Armour only reduces physical damage. Elemental damage ignores armour. */
export function damageAfterDefense(amount: number, type: DamageType, armour: number, resists: Resistances): number {
  if (amount <= 0) return 0;
  if (type === 'physical') return Math.max(1, Math.round(amount - armour));
  return Math.round(amount * resistanceFactor(resists[type] ?? 0));
}

export const ELEMENT_COLOURS: Readonly<Record<ResistName, string>> = {
  fire: '#f59445',
  cold: '#85d9ff',
  electric: '#ffe36a',
  poison: '#8bd86b',
  negative: '#c59aff',
};
