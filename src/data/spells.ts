import spellsRaw from './json/spells.json';
import type { ResistName } from './items';
import { SCHOOL_IDS } from './skills';

export type SpellShape =
  | 'projectile'
  | 'beam'
  | 'burst'
  | 'cloud'
  | 'utility'
  | 'chain'
  | 'cone'
  | 'aura'
  | 'buff'
  | 'mark'
  | 'storm'
  | 'delayed'
  | 'field'
  | 'terrain'
  | 'summon'
  | 'construct'
  | 'debuff'
  | 'teleport';

/** Rider effects a damaging spell leaves on the monsters it hits. */
export type HitEffect = 'slow' | 'stun' | 'confuse' | 'vulnerable' | 'rot' | 'poison' | 'burn' | 'knockback' | 'pull' | 'drain';

export interface SpellHit {
  readonly effect: HitEffect;
  /** slow: speed loss 0..1; vulnerable: extra damage taken; rot: armour removed; poison/burn: damage per second;
   * knockback/pull: push speed; drain: share of damage healed. */
  readonly power?: number;
  readonly duration?: number;
  /** rot: damage per second while it lasts. */
  readonly damage?: number;
}

export interface SpellData {
  readonly id: string;
  readonly name: string;
  readonly school: string;
  readonly requirement?: number;
  readonly level: number;
  /** Levels 1, 4 and 7 are free automatic attacks for staves and rods; the rest are buttons. */
  readonly auto?: boolean;
  /** Spells whose behaviour is not implemented yet stay in the data but never reach play. */
  readonly enabled: boolean;
  readonly mana: number;
  /** Mana a monster pays instead of `mana`; free hero auto attacks still cost monsters. */
  readonly monsterMana?: number;
  /** Seconds before this button spell can be cast again. */
  readonly cooldown?: number;
  readonly shape: SpellShape;
  /** Damage type; omitted means physical (armour applies). */
  readonly element?: ResistName;
  readonly damage?: number;
  readonly range?: number;
  readonly speed?: number;
  readonly radius?: number;
  readonly duration?: number;
  readonly tick?: number;
  readonly pierce?: number;
  readonly targets?: number;
  readonly chainRadius?: number;
  readonly power?: number;
  readonly ally?: string;
  readonly count?: number;
  readonly colour: string;
  readonly effect?: string;
  readonly distance?: number;
  readonly onHit?: SpellHit;
  /** Projectile turn rate towards its target, radians per second. */
  readonly homing?: number;
  /** Projectile bursts on impact with this radius. */
  readonly impactRadius?: number;
  /** Projectile zaps the nearest monster within this distance as it flies. */
  readonly zapRadius?: number;
  /** Projectile leaves short flames behind it. */
  readonly trail?: boolean;
  /** Cone width in degrees. */
  readonly angle?: number;
}

export const SPELLS: readonly SpellData[] = spellsRaw as readonly SpellData[];

export const SPELL_SHAPES: readonly SpellShape[] = [
  'projectile',
  'beam',
  'burst',
  'cloud',
  'utility',
  'chain',
  'cone',
  'aura',
  'buff',
  'mark',
  'storm',
  'delayed',
  'field',
  'terrain',
  'summon',
  'construct',
  'debuff',
  'teleport',
];

/** Shapes with working behaviour. A spell may only be enabled when its shape is here. */
export const ACTIVE_SPELL_SHAPES: readonly SpellShape[] = [
  'projectile',
  'beam',
  'burst',
  'cloud',
  'utility',
  'buff',
  'debuff',
  'cone',
  'chain',
  'aura',
  'storm',
  'delayed',
  'field',
  'mark',
];

/** Named effects with working behaviour. An enabled spell's effect must be one of these. */
export const ACTIVE_SPELL_EFFECTS: readonly string[] = [
  'blink',
  'guard',
  'armour',
  'speed',
  'freeze',
  'confuse',
  'rot',
  'explode',
  'harvest',
];

export const HIT_EFFECTS: readonly HitEffect[] = [
  'slow',
  'stun',
  'confuse',
  'vulnerable',
  'rot',
  'poison',
  'burn',
  'knockback',
  'pull',
  'drain',
];

/** Spells cast on the hero (no target to pick). */
export function selfSpell(spell: SpellData): boolean {
  return spell.shape === 'utility' || spell.shape === 'buff';
}

export const MAX_SPELL_LEVEL = 9;
const AUTO_LEVELS: readonly number[] = [1, 4, 7];
const ELEMENTS: readonly ResistName[] = ['fire', 'cold', 'electric', 'negative', 'poison'];

function validNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validateEnabled(spell: SpellData, label: string): void {
  if (!ACTIVE_SPELL_SHAPES.includes(spell.shape)) throw new Error(label + ': 구현되지 않은 shape는 켤 수 없음 ' + spell.shape);
  if (spell.effect !== undefined && !ACTIVE_SPELL_EFFECTS.includes(spell.effect)) {
    throw new Error(label + ': 구현되지 않은 effect는 켤 수 없음 ' + spell.effect);
  }
  if (selfSpell(spell) || spell.shape === 'debuff') {
    if (!spell.effect) throw new Error(label + ': ' + spell.shape + ' 주문에는 effect가 필요함');
    if (selfSpell(spell)) return;
  }
  const harmless = spell.shape === 'debuff' || (spell.shape === 'mark' && spell.effect === 'harvest');
  if (!harmless && !validNumber(spell.damage)) throw new Error(label + ': 공격 주문에는 damage가 필요함');
  const aroundHero = spell.shape === 'aura' || spell.shape === 'field';
  if (!aroundHero && !validNumber(spell.range)) throw new Error(label + ': 공격 주문에는 range가 필요함');
}

function validateSpell(spell: SpellData, label: string): void {
  if (!Number.isInteger(spell.level) || spell.level < 1 || spell.level > MAX_SPELL_LEVEL) {
    throw new Error(label + ': level은 1~' + MAX_SPELL_LEVEL);
  }
  if (!validNumber(spell.mana)) throw new Error(label + ': mana가 잘못됨');
  if (spell.monsterMana !== undefined && !validNumber(spell.monsterMana)) throw new Error(label + ': monsterMana가 잘못됨');
  if (typeof spell.school !== 'string' || !SCHOOL_IDS.has(spell.school)) {
    throw new Error(label + ': 정확히 하나의 유효한 school이 필요함');
  }
  if (!SPELL_SHAPES.includes(spell.shape)) throw new Error(label + ': 모르는 shape ' + spell.shape);
  if (typeof spell.enabled !== 'boolean') throw new Error(label + ': enabled가 필요함');
  if ((spell.auto === true) !== AUTO_LEVELS.includes(spell.level)) throw new Error(label + ': auto는 1·4·7레벨에만');
  if (spell.auto && spell.mana !== 0) throw new Error(label + ': 자동 공격 마법은 mana 0');
  if (!spell.auto && !validNumber(spell.cooldown)) throw new Error(label + ': 버튼 마법에는 cooldown이 필요함');
  if (spell.element !== undefined && !ELEMENTS.includes(spell.element)) throw new Error(label + ': 모르는 element');
  if (spell.requirement !== undefined && (!Number.isInteger(spell.requirement) || spell.requirement < 0)) {
    throw new Error(label + ': 잘못된 requirement');
  }
  for (const key of ['homing', 'impactRadius', 'zapRadius', 'angle'] as const) {
    if (spell[key] !== undefined && !validNumber(spell[key])) throw new Error(label + ': ' + key + '가 잘못됨');
  }
  if (spell.shape === 'mark' && spell.effect !== 'explode' && spell.effect !== 'harvest')
    throw new Error(label + ': 표식은 explode 또는 harvest');
  if (spell.onHit !== undefined) {
    if (!HIT_EFFECTS.includes(spell.onHit.effect)) throw new Error(label + ': 모르는 onHit ' + spell.onHit.effect);
    if (spell.onHit.power !== undefined && !validNumber(spell.onHit.power)) throw new Error(label + ': onHit.power');
    if (spell.onHit.duration !== undefined && !validNumber(spell.onHit.duration)) throw new Error(label + ': onHit.duration');
  }
  if (spell.enabled) validateEnabled(spell, label);
}

const usedIds = new Set<string>();
for (const spell of SPELLS) {
  const label = 'spells.json: ' + spell.id;
  if (usedIds.has(spell.id)) throw new Error(label + ': 중복 id');
  usedIds.add(spell.id);
  validateSpell(spell, label);
}

/** What a monster pays to cast this spell. */
export function monsterSpellMana(spell: SpellData): number {
  return spell.monsterMana ?? spell.mana;
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
