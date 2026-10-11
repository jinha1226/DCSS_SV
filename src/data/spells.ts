import spellsRaw from './json/spells.json';

export type SpellShape =
  | 'projectile'
  | 'beam'
  | 'burst'
  | 'cloud'
  | 'utility'
  | 'chain'
  | 'summon'
  | 'construct'
  | 'debuff'
  | 'teleport';

export interface SpellData {
  readonly id: string;
  readonly name: string;
  readonly schools: readonly string[];
  readonly requirements?: Readonly<Record<string, number>>;
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
  if (!Array.isArray(spell.schools) || spell.schools.length === 0) {
    throw new Error(label + ': schools는 비어 있지 않은 배열이어야 함');
  }
  if (new Set(spell.schools).size !== spell.schools.length || spell.schools.some((s) => typeof s !== 'string' || !s)) {
    throw new Error(label + ': schools에 잘못된 학파가 있음');
  }
  if (!SPELL_SHAPES.includes(spell.shape)) throw new Error(label + ': 모르는 shape ' + spell.shape);
  if (spell.requirements) {
    if (Object.keys(spell.requirements).some((school) => !spell.schools.includes(school))) {
      throw new Error(label + ': requirements에 없는 학파가 있음');
    }
    for (const school of spell.schools) {
      const needed = spell.requirements[school];
      if (!Number.isInteger(needed) || needed < 1 || needed > 8) {
        throw new Error(label + ': requirements의 레벨은 1~8');
      }
    }
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
  return SPELLS.filter((spell) => spell.schools.includes(school)).sort((a, b) => a.level - b.level);
}

export const SPELL_SCHOOLS = [...new Set(SPELLS.flatMap((spell) => spell.schools))];
