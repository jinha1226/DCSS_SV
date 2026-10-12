import { brandData, type ResistName } from '../data/items';
import { weaponOption } from '../sim/equipment';
import { effectValue, xpToNext } from '../sim/skills';
import type { World } from '../sim/world';

const RESISTS: readonly { id: ResistName; label: string }[] = [
  { id: 'fire', label: '화염저항' },
  { id: 'cold', label: '냉기저항' },
  { id: 'electric', label: '전기저항' },
  { id: 'poison', label: '독저항' },
  { id: 'negative', label: '음에너지' },
];

export interface StatusValue {
  readonly label: string;
  readonly value: string;
  readonly tone?: 'positive' | 'negative' | 'muted';
}

export function statusValues(w: World): { vitals: StatusValue[]; resists: StatusValue[]; equipment: StatusValue[]; extra: StatusValue[] } {
  const resists = RESISTS.map(({ id, label }) => {
    const level = w.heroDef.resists[id] ?? 0;
    return {
      label,
      value: level > 0 ? '+'.repeat(level) : level < 0 ? '-'.repeat(-level) : '· · ·',
      tone: level > 0 ? ('positive' as const) : level < 0 ? ('negative' as const) : ('muted' as const),
    };
  });
  const slots = [
    ['무기', w.weapon.name + (w.weapon.brand ? ' (' + brandData(w.weapon.brand)?.name + ')' : '')],
    ['보조장비', '미착용'],
    ['갑옷', '미착용'],
    ['방패', w.weapon.hands === 2 ? '양손 무기 사용 중' : '미착용'],
    ['투구', '미착용'],
    ['장갑', '미착용'],
    ['장화', '미착용'],
    ['망토', '미착용'],
    ['목걸이', '미착용'],
    ['반지 1', '미착용'],
    ['반지 2', '미착용'],
  ] as const;
  const armour = effectValue(w, 'armour.reduce') + weaponOption(w.weapon, 'armour');
  const evasion = effectValue(w, 'dodging.chance') + weaponOption(w.weapon, 'evasion');
  const shield = w.weapon.hands === 2 ? 0 : effectValue(w, 'shield.chance');
  return {
    vitals: [
      { label: '체력', value: Math.ceil(w.hero.hp) + '/' + w.hero.maxHp },
      { label: '마력', value: Math.floor(w.hero.mana) + '/' + w.hero.maxMana },
      { label: '레벨', value: String(w.hero.level) },
      { label: '경험치', value: Math.floor(w.hero.xp) + '/' + xpToNext(w.hero.level) },
      { label: '물리감소', value: armour.toFixed(1) },
      { label: '회피확률', value: Math.round(evasion * 100) + '%' },
      { label: '방패확률', value: Math.round(shield * 100) + '%' },
      { label: '처치', value: String(w.kills) },
      { label: '룬', value: w.runes.size + '/2' },
      { label: '금화', value: String(w.gold) },
      { label: '조트의 보주', value: w.orbCollected ? '획득' : '미획득' },
    ],
    resists,
    equipment: slots.map(([label, value]) => ({ label, value, tone: value === '미착용' ? ('muted' as const) : undefined })),
    extra: [
      { label: '체력재생', value: w.heroDef.regen.toFixed(2) + '/초' },
      { label: '마력재생', value: w.heroDef.manaRegen.toFixed(2) + '/초' },
      { label: '무기 피해', value: String(w.weapon.damage + weaponOption(w.weapon, 'damage')) },
      { label: '공격 간격', value: w.weapon.every.toFixed(2) + '초' },
      { label: '투척물', value: String(w.ammo) },
      { label: '고유 특성', value: w.heroDef.traits.length ? w.heroDef.traits.map((trait) => trait.id).join(', ') : '없음' },
    ],
  };
}

export interface StatusSheet {
  readonly open: boolean;
  show(w: World): void;
  openSheet(): void;
  close(): void;
}

export function makeStatusSheet(root: HTMLElement): StatusSheet {
  const panel = document.createElement('section');
  panel.className = 'status-sheet';
  panel.setAttribute('aria-label', '캐릭터 상태');
  const header = document.createElement('header');
  header.className = 'status-header';
  const title = document.createElement('strong');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '닫기 ×';
  header.append(title, close);
  const body = document.createElement('div');
  body.className = 'status-body';
  const overview = document.createElement('div');
  overview.className = 'status-vitals';
  const columns = document.createElement('div');
  columns.className = 'status-columns';
  const resists = document.createElement('div');
  const equipment = document.createElement('div');
  columns.append(resists, equipment);
  const extra = document.createElement('div');
  extra.className = 'status-extra';
  body.append(overview, columns, extra);
  panel.append(header, body);
  root.append(panel);
  let world: World | undefined;
  let opened = false;
  let lastKey = '';

  close.addEventListener('click', () => {
    opened = false;
    panel.classList.remove('on');
  });
  const renderRows = (target: HTMLElement, values: readonly StatusValue[]): void => {
    target.replaceChildren();
    for (const entry of values) {
      const line = document.createElement('div');
      line.className = 'status-line';
      const label = document.createElement('span');
      label.textContent = entry.label;
      const value = document.createElement('span');
      value.className = 'status-value' + (entry.tone ? ' ' + entry.tone : '');
      value.textContent = entry.value;
      line.append(label, value);
      target.append(line);
    }
  };
  return {
    get open() {
      return opened;
    },
    show(w) {
      world = w;
      if (w.over && opened) this.close();
      if (!opened) return;
      const key = [
        w.hero.hp,
        w.hero.mana,
        w.hero.level,
        w.hero.xp,
        w.kills,
        w.ammo,
        w.weapon.uid,
        w.heroDef.species,
        [...w.runes].sort().join(','),
        w.orbCollected,
        w.gold,
      ].join('|');
      if (key === lastKey) return;
      lastKey = key;
      title.textContent = w.heroDef.name + ' · 지하 ' + w.depth + '층';
      const values = statusValues(w);
      renderRows(overview, values.vitals);
      renderRows(resists, values.resists);
      renderRows(equipment, values.equipment);
      renderRows(extra, values.extra);
    },
    openSheet() {
      if (!world || world.over) return;
      opened = true;
      lastKey = '';
      panel.classList.add('on');
      this.show(world);
    },
    close() {
      opened = false;
      panel.classList.remove('on');
    },
  };
}
