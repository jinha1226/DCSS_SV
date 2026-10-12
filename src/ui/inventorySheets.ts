import { brandData } from '../data/items';
import { itemDefinition } from '../data/itemCatalog';
import { buyOffer, shopAccessible } from '../sim/branchLoot';
import { itemDisplayName } from '../sim/identification';
import { equipGear, unequipGear, dropGear, gearName, gearBonus, type GearSlot } from '../sim/gear';
import { CONSUMABLES, dropConsumable, useConsumable, type ConsumableId } from '../sim/consumables';
import { dropStoredWeapon, equipStoredWeapon, weaponOption, weaponScore } from '../sim/equipment';
import type { World } from '../sim/world';

export type BagTab = 'all' | 'equipment' | 'consumable' | 'other';
export type SheetName = 'equipment' | 'bag' | 'shop';

export interface EquipmentSlot {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly available: boolean;
}
const SLOTS = [
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
] as const;
export function equipmentSlots(w: World): EquipmentSlot[] {
  return SLOTS.map((slot) => ({
    ...slot,
    value:
      slot.id === 'weapon'
        ? w.weapon.name + ((w.weapon.enchantment ?? 0) > 0 ? ' +' + w.weapon.enchantment : '')
        : w.gear[slot.id as GearSlot]
          ? gearName(w, w.gear[slot.id as GearSlot]!)
          : '—',
    available: slot.id === 'weapon' || slot.id !== 'offhand',
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
  for (const item of w.inventory) {
    if (item.kind === 'weapon') {
      items.push({ id: item.uid, name: item.weapon.name, group: 'equipment', count: 1, equipped: false });
    } else if (item.kind === 'gear') {
      items.push({ id: item.uid, name: gearName(w, item.id), group: 'equipment', count: 1, equipped: false });
    } else {
      items.push({
        id: item.uid,
        name: itemDisplayName(w, item.id),
        group: 'consumable',
        count: item.count,
        equipped: false,
      });
    }
  }
  for (const branch of [...w.runes].sort())
    items.push({ id: 'rune-' + branch, name: branch + '의 룬', group: 'other', count: 1, equipped: false });
  if (w.orbCollected) items.push({ id: 'orb-zot', name: '조트의 보주', group: 'other', count: 1, equipped: false });
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
  let feedback = '';

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
  const action = (label: string, handler: () => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-action';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  };
  const draw = (w: World): void => {
    if (!sheet) return;
    const key = [
      sheet,
      tab,
      w.weapon.uid,
      w.weapon.enchantment ?? 0,
      JSON.stringify(w.gear),
      JSON.stringify(w.gearEnchantment),
      [...w.cursedGear].join(','),
      [...w.identifiedItems].join(','),
      w.ammo,
      [...w.runes].sort().join(','),
      w.orbCollected,
      w.hero.hp,
      w.hero.maxHp,
      w.inventory.map((item) => item.uid + ':' + (item.kind === 'consumable' ? item.count : 1)).join(','),
      feedback,
      w.gold,
      w.shopStock.map((offer) => offer.uid).join(','),
    ].join('|');
    if (key === lastKey) return;
    lastKey = key;
    title.textContent = sheet === 'equipment' ? '장비' : sheet === 'shop' ? '오크 상점 · 금화 ' + w.gold : '가방';
    tabs.replaceChildren();
    content.replaceChildren();

    if (sheet === 'shop') {
      if (!shopAccessible(w)) {
        content.append(row('상점', 'Orc 3층 상점 근처에서 이용 가능'));
      } else {
        for (const offer of w.shopStock) {
          const name = offer.weapon?.name ?? (offer.itemId ? itemDefinition(offer.itemId).name : '상품');
          const line = row(name, offer.price + ' 금화');
          line.append(
            action('구매', () => {
              feedback = buyOffer(w, offer.uid) ? '구매 완료' : '금화가 부족하거나 구매할 수 없어.';
              lastKey = '';
              draw(w);
            }),
          );
          content.append(line);
        }
        if (!w.shopStock.length) content.append(row('상점', '품절'));
      }
      if (feedback) content.append(row('알림', feedback));
    } else if (sheet === 'equipment') {
      for (const slot of equipmentSlots(w)) {
        const line = row(slot.name, slot.value, !slot.available);
        if (slot.id === 'weapon') {
          line.append(
            action('교체', () => {
              tab = 'equipment';
              setSheet('bag');
              draw(w);
            }),
          );
        }
        if (slot.id !== 'weapon' && slot.id !== 'offhand' && w.gear[slot.id as GearSlot]) {
          line.append(
            action('해제', () => {
              feedback = unequipGear(w, slot.id as GearSlot) ? '장비 해제' : '저주받은 장비는 해제할 수 없어.';
              lastKey = '';
              draw(w);
            }),
          );
        }
        content.append(line);
      }
      const summary = document.createElement('div');
      summary.className = 'inventory-summary';
      const brand = brandData(w.weapon.brand)?.name ?? '없음';
      summary.textContent =
        '피해 ' +
        (w.weapon.damage + (w.weapon.enchantment ?? 0) + weaponOption(w.weapon, 'damage')) +
        ' · 공격 간격 ' +
        w.weapon.every.toFixed(2) +
        '초 · ' +
        (w.weapon.hands === 2 ? '양손' : '한손') +
        ' · 속성 ' +
        brand;
      content.append(summary);
      const note = document.createElement('p');
      note.className = 'inventory-note';
      note.textContent =
        '방어력 +' +
        gearBonus(w, 'armour') +
        ' · 방패 +' +
        gearBonus(w, 'shield') +
        ' · 화염 저항 +' +
        gearBonus(w, 'fire_resist') +
        ' · 냉기 저항 +' +
        gearBonus(w, 'cold_resist');
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
          const line = row(item.name, item.equipped ? '장착 중' : '×' + item.count);
          if (!item.equipped && item.group === 'equipment') {
            const stored = w.inventory.find((entry) => entry.uid === item.id);
            if (stored?.kind === 'weapon') {
              const detail = document.createElement('small');
              detail.className = 'inventory-weapon-detail';
              const compared = weaponScore(stored.weapon) - weaponScore(w.weapon);
              detail.textContent =
                '피해 ' +
                (stored.weapon.damage + (stored.weapon.enchantment ?? 0) + weaponOption(stored.weapon, 'damage')) +
                ' / 간격 ' +
                stored.weapon.every.toFixed(2) +
                '초 / ' +
                (stored.weapon.hands === 2 ? '양손' : '한손') +
                ' / 현재 무기 대비 ' +
                (compared >= 0 ? '+' : '') +
                compared.toFixed(1);
              line.append(detail);
              line.append(
                action('장착', () => {
                  equipStoredWeapon(w, item.id);
                  lastKey = '';
                  draw(w);
                }),
                action('버리기', () => {
                  dropStoredWeapon(w, item.id);
                  lastKey = '';
                  draw(w);
                }),
              );
            } else if (stored?.kind === 'gear') {
              line.append(
                action('장착', () => {
                  feedback = equipGear(w, item.id) ? '장비 장착' : '장착할 수 없어. 양손무기 또는 저주를 확인해.';
                  lastKey = '';
                  draw(w);
                }),
                action('버리기', () => {
                  feedback = dropGear(w, item.id) ? '장비 버림' : '버릴 수 없어.';
                  lastKey = '';
                  draw(w);
                }),
              );
            }
          }
          if (item.group === 'consumable') {
            const config = CONSUMABLES[item.id as ConsumableId];
            if (config) {
              line.append(
                action(config.action, () => {
                  if (item.id === 'scroll_identify') {
                    const targets = w.inventory.filter(
                      (entry) => entry.kind === 'consumable' && entry.id !== item.id && !w.identifiedItems.has(entry.id),
                    );
                    if (targets.length > 0) {
                      const target = window.prompt(
                        '감정할 아이템 번호를 입력하세요:\\n' +
                          targets
                            .map((entry, index) => index + 1 + '. ' + (entry.kind === 'consumable' ? itemDisplayName(w, entry.id) : ''))
                            .join('\\n'),
                      );
                      const selected = target === null ? undefined : targets[Number(target) - 1];
                      if (!selected || selected.kind !== 'consumable') {
                        feedback = '감정을 취소했어.';
                        lastKey = '';
                        draw(w);
                        return;
                      }
                      feedback = useConsumable(w, item.id, selected.id)
                        ? '감정 완료: ' + itemDisplayName(w, selected.id)
                        : '감정할 수 없어.';
                    } else feedback = '감정할 아이템이 없어.';
                  } else
                    feedback = useConsumable(w, item.id as ConsumableId) ? itemDisplayName(w, item.id) + ' 사용' : '지금은 사용할 수 없어.';
                  lastKey = '';
                  draw(w);
                }),
                action('버리기', () => {
                  feedback = dropConsumable(w, item.id as ConsumableId) ? itemDisplayName(w, item.id) + ' 1개 버림' : '버릴 수 없어.';
                  lastKey = '';
                  draw(w);
                }),
              );
            }
          }
          content.append(line);
        }
      } else {
        const empty = document.createElement('p');
        empty.className = 'inventory-note';
        empty.textContent = '이 분류에 보유한 아이템이 없어.';
        content.append(empty);
      }
      if (feedback) {
        const note = document.createElement('p');
        note.className = 'inventory-note';
        note.textContent = feedback;
        content.append(note);
      }
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
      feedback = '';
      setSheet(name);
      draw(current);
    },
    close() {
      setSheet(undefined);
    },
  };
}
