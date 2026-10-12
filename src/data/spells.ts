import spellsRaw from './json/spells.json';
import { SCHOOL_IDS } from './skills';

export type SpellShape = 'projectile' | 'beam' | 'burst' | 'cloud' | 'utility' | 'chain' | 'summon' | 'construct' | 'debuff' | 'teleport';

export interface SpellData {
  readonly id: string;
  readonly name: string;
  readonly school: string;
  readonly requirement?: number;
  readonly level: number;
  readonly mana: number;
  readonly shape: SpellShape;
  readonly damage?: number;
  readonly range?: number;
  readonly speed?: number;
  readonly radius?: number;
  readonly duration?: number;
  readonly tick?: number;
  readonly pierce?: number;
  readonly targets?: number;
  readonly chainRadius?: number;
  readonly colour: string;
  readonly effect?: string;
  readonly distance?: number;
}

export const SPELLS: readonly SpellData[] = spellsRaw as readonly SpellData[];

export const SPELL_SHAPES: readonly SpellShape[] = [
  'projectile',
  'beam',
  'burst',
  'cloud',
  'utility',
  'chain',
  'summon',
  'construct',
  'debuff',
  'teleport',
];

export const ACTIVE_SPELL_SHAPES: readonly SpellShape[] = ['projectile', 'beam', 'burst', 'cloud', 'utility'];

const usedIds = new Set<string>();
for (const spell of SPELLS) {
  const label = 'spells.json: ' + spell.id;
  if (usedIds.has(spell.id)) throw new Error(label + ': 중복 id');
  usedIds.add(spell.id);
  if (!Number.isInteger(spell.level) || spell.level < 1 || spell.level > 7) {
    throw new Error(label + ': level은 1~7');
  }
  if (!Number.isFinite(spell.mana) || spell.mana < 0) throw new Error(label + ': mana가 잘못됨');
  if (typeof spell.school !== 'string' || !SCHOOL_IDS.has(spell.school)) {
    throw new Error(label + ': 정확히 하나의 유효한 school이 필요함');
  }
  if (!SPELL_SHAPES.includes(spell.shape)) throw new Error(label + ': 모르는 shape ' + spell.shape);
  if (spell.requirement !== undefined && (!Number.isInteger(spell.requirement) || spell.requirement < 0)) {
    throw new Error(label + ': 잘못된 requirement');
  }
  if (ACTIVE_SPELL_SHAPES.includes(spell.shape) && spell.shape !== 'utility') {
    if (typeof spell.damage !== 'number' || spell.damage < 0 || !Number.isFinite(spell.damage)) {
      throw new Error(label + ': 공격 주문에는 damage가 필요함');
    }
    if (typeof spell.range !== 'number' || spell.range < 0 || !Number.isFinite(spell.range)) {
      throw new Error(label + ': 공격 주문에는 range가 필요함');
    }
  }
  if (spell.shape === 'utility' && !spell.effect) throw new Error(label + ': 보조 주문에는 effect가 필요함');
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
