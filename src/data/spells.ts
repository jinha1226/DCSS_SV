import spellsRaw from './json/spells.json';

export type SpellShape = 'projectile' | 'beam' | 'burst' | 'cloud';

export interface SpellData {
  readonly id: string;
  readonly name: string;
  readonly school: string;
  readonly level: number;
  readonly mana: number;
  readonly shape: SpellShape;
  readonly damage: number;
  readonly range: number;
  readonly speed?: number;
  readonly radius?: number;
  readonly duration?: number;
  readonly tick?: number;
  readonly pierce?: number;
  readonly colour: string;
}

export const SPELLS: readonly SpellData[] = spellsRaw as readonly SpellData[];

for (const spell of SPELLS) {
  if (spell.level < 1 || spell.level > 7) throw new Error('spells.json: ' + spell.id + ': level은 1~7');
  if (!['projectile', 'beam', 'burst', 'cloud'].includes(spell.shape)) {
    throw new Error('spells.json: ' + spell.id + ': 모르는 shape ' + spell.shape);
  }
}

export function spellData(id: string): SpellData {
  const spell = SPELLS.find((entry) => entry.id === id);
  if (!spell) throw new Error('spells.json: ' + id + ': 없는 주문');
  return spell;
}

export function schoolSpells(school: string): readonly SpellData[] {
  return SPELLS.filter((spell) => spell.school === school).sort((a, b) => a.level - b.level);
}

export const SPELL_SCHOOLS = [...new Set(SPELLS.map((spell) => spell.school))];
