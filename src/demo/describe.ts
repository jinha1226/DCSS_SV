import type { SpellData, SpellShape } from '../data/spells';
import type { ResistName } from '../data/items';

/** Plain Korean lines for the demo card: what the spell is and what it does. */
const SHAPES: Readonly<Record<SpellShape, string>> = {
  projectile: '투사체',
  beam: '광선',
  burst: '폭발',
  cloud: '구름',
  utility: '보조',
  buff: '강화',
  debuff: '약화',
  cone: '부채꼴',
  chain: '연쇄',
  aura: '오라',
  storm: '폭풍',
  delayed: '예고 폭발',
  field: '시야 전체',
  mark: '표식',
  terrain: '지형',
  summon: '소환',
  construct: '구조물',
  teleport: '순간이동',
};

const ELEMENTS: Readonly<Record<ResistName, string>> = { fire: '화염', cold: '냉기', electric: '전기', poison: '독', negative: '음에너지' };

const RIDERS: Readonly<Record<string, string>> = {
  slow: '둔화',
  stun: '기절',
  confuse: '혼란',
  vulnerable: '약점(받는 피해 증가)',
  rot: '부패',
  poison: '독',
  burn: '화상',
  knockback: '넉백',
  pull: '끌어당김',
  drain: '흡혈',
};

const EFFECTS: Readonly<Record<string, string>> = {
  blink: '앞으로 순간이동',
  guard: '잠깐 무적',
  armour: '갑옷 증가',
  speed: '이동 속도 증가',
  freeze: '얼려서 기절',
  confuse: '혼란',
  rot: '갑옷 감소와 지속 피해',
  explode: '죽으면 폭발하고 옆으로 번짐',
  harvest: '죽으면 HP·MP 회복',
};

/** Which later bundle brings a spell that is still off. */
function laterBundle(spell: SpellData): string {
  if (spell.shape === 'summon' || spell.shape === 'construct') return '묶음 E(아군)';
  return '묶음 D(지형·시간)';
}

export function spellTags(spell: SpellData): string[] {
  const tags = [spell.level + '레벨', spell.auto ? '자동 공격' : '버튼', SHAPES[spell.shape]];
  tags.push(spell.element ? ELEMENTS[spell.element] : '물리');
  return tags;
}

export function spellSummary(spell: SpellData): string {
  if (!spell.enabled) return '아직 동작이 없습니다. ' + laterBundle(spell) + '에서 켭니다.';
  const parts: string[] = [];
  if (spell.damage) parts.push('피해 ' + spell.damage);
  if (spell.effect && EFFECTS[spell.effect]) parts.push(EFFECTS[spell.effect]!);
  if (spell.onHit) parts.push(RIDERS[spell.onHit.effect] ?? spell.onHit.effect);
  if (spell.homing) parts.push('유도');
  if (spell.impactRadius) parts.push('맞으면 폭발');
  if (spell.zapRadius) parts.push('지나가며 주변 감전');
  if (spell.trail) parts.push('지나간 자리에 불길');
  if (spell.duration && ['aura', 'storm', 'field', 'buff', 'cloud'].includes(spell.shape)) parts.push(spell.duration + '초');
  if (!spell.auto) parts.push(spell.mana + ' MP · 쿨다운 ' + spell.cooldown + '초');
  return parts.join(' · ');
}
