import { brandData } from '../data/items';
import { weaponOption } from '../sim/equipment';
import type { World } from '../sim/world';

export type BagTab = 'all' | 'equipment' | 'consumable' | 'other';
export type SheetName = 'equipment' | 'bag';

export interface EquipmentSlot {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly available: boolean;
}

const SLOTS: readonly { id: string; name: string }[] = [
  { id: 'weapon', name: '무기' },
  { id: 'offhand', name: '보조무기' },
  { id: 'armour', name: '갑옷' },
  { id: 'shield', name: '방패' },
  { id: 'helmet', name: '투구' },
  { id: 'gloves', name: '장갑' },
  { id: 'boots', name: '장화' },
  { id: 'cloak', name: '망토' },
  { id: 'amulet', name: '목걸이' },
  { id: 'ring1', name: '반지 1' },
  { id: 'ring2', name: '반지 2' },
];

/** Only the weapon is currently equippable. Empty slots are not fake equipment. */
export function equipmentSlots(w: World): EquipmentSlot[] {
  return SLOTS.map((slot) => ({
    ...slot,
    value: slot.id === 'weapon' ? w.weapon.name : '—',
    available: slot.id === 'weapon',
  }));
}

export interface BagEntry {
  readonly id: string;
  readonly name: string;
  readonly group: Exclude<BagTab, 'all'>;
  readonly count: number;
  readonly equipped: boolean;
}

export function bagEntries(w: World): BagEntry[] {
  const items: BagEntry[] = [{ id: w.weapon.uid, name: w.weapon.name, group: 'equipment', count: 1, equipped: true }];
  if (w.openSkills.has('throwing')) {
    items.push({ id: 'ammo', name: '부메랑', group: 'other', count: w.ammo, equipped: false });
  }
  return items;
}

export interface InventorySheets {
  readonly open: boolean;
  show(w: World): void;
  openSheet(sheet: SheetName): void;
  close(): void;
}

export function makeInventorySheets(root: HTMLElement): InventorySheets {
  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'inventory-shade';
  backdrop.setAttribute('aria-label', '장비와 가방 닫기');
  root.append(backdrop);
  const panel = document.createElement('section');
  panel.className = 'inventory-sheet';
  panel.setAttribute('aria-label', '장비와 가방');
  const header = document.createElement('div');
  header.className = 'inventory-header';
  const title = document.createElement('strong');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '닫기 ×';
  header.append(title, close);
  const tabs = document.createElement('div');
  tabs.className = 'inventory-tabs';
  const content = document.createElement('div');
  content.className = 'inventory-content';
  panel.append(header, tabs, content);
  root.append(panel);

  let current: World | undefined;
  let sheet: SheetName | undefined;
  let tab: BagTab = 'all';
  let lastKey = '';

  const setSheet = (value: SheetName | undefined): void => {
    sheet = value;
    lastKey = '';
    backdrop.classList.toggle('on', Boolean(sheet));
    panel.classList.toggle('on', Boolean(sheet));
  };
  backdrop.addEventListener('click', () => setSheet(undefined));
  close.addEventListener('click', () => setSheet(undefined));

  const row = (name: string, value: string, disabled = false): HTMLElement => {
    const line = document.createElement('div');
    line.className = 'inventory-row' + (disabled ? ' unavailable' : '');
    const label = document.createElement('span');
    label.textContent = name;
    const data = document.createElement('span');
    data.textContent = value;
    line.append(label, data);
    return line;
  };
  const draw = (w: World): void => {
    if (!sheet) return;
    const key = [
      sheet,
      tab,
      w.weapon.uid,
      w.ammo,
      w.openSkills.has('throwing'),
      w.hero.hp,
    ].join('|');
    if (key === lastKey) return;
    lastKey = key;
    title.textContent = sheet === 'equipment' ? '장비' : '가방';
    tabs.replaceChildren();
    content.replaceChildren();

    if (sheet === 'equipment') {
      for (const slot of equipmentSlots(w)) content.append(row(slot.name, slot.value, !slot.available));
      const summary = document.createElement('div');
      summary.className = 'inventory-summary';
      const brand = brandData(w.weapon.brand)?.name ?? '없음';
      summary.textContent =
        '피해 ' + (w.weapon.damage + weaponOption(w.weapon, 'damage')) +
        ' · 공격 간격 ' + w.weapon.every.toFixed(2) + '초 · ' +
        (w.weapon.hands === 2 ? '양손' : '한손') + ' · 속성 ' + brand;
      content.append(summary);
      const note = document.createElement('p');
      note.className = 'inventory-note';
      note.textContent = '현재 무기 외 장비 슬롯은 추후 추가될 예정이야.';
      content.append(note);
    } else {
      const names: { id: BagTab; label: string }[] = [
        { id: 'all', label: '전체' },
        { id: 'equipment', label: '장비' },
        { id: 'consumable', label: '소모품' },
        { id: 'other', label: '기타' },
      ];
      for (const item of names) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = item.label;
        button.classList.toggle('selected', tab === item.id);
        button.addEventListener('click', () => {
          tab = item.id;
          lastKey = '';
          draw(w);
        });
        tabs.append(button);
      }
      const entries = bagEntries(w).filter((item) => tab === 'all' || tab === item.group);
      if (entries.length) {
        for (const item of entries) {
          content.append(row(item.name, item.equipped ? '장착 중' : '×' + item.count));
        }
      } else {
        const empty = document.createElement('p');
        empty.className = 'inventory-note';
        empty.textContent = '이 분류에 보유한 아이템이 없어.';
        content.append(empty);
      }
      const note = document.createElement('p');
      note.className = 'inventory-note';
      note.textContent = '지금은 장착한 무기와 투척 탄약만 표시돼. 무기 보관·교체는 다음 단계에서 연결할게.';
      content.append(note);
    }
  };
  return {
    get open() {
      return Boolean(sheet);
    },
    show(w) {
      current = w;
      if (w.over) setSheet(undefined);
      if (sheet) draw(w);
    },
    openSheet(name) {
      if (!current || current.over) return;
      tab = 'all';
      setSheet(name);
      draw(current);
    },
    close() {
      setSheet(undefined);
    },
  };
}
