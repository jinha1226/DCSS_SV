import type { ResistName } from '../data/items';
import { SLOTS, slotData, upgradeSlot, type RingSlotId, type SlotId } from '../sim/slots';
import type { World } from '../sim/world';
import type { Atlas } from '../view/atlas';
import { composeDoll, dollLayers } from '../view/doll';

export interface SlotPicker {
  show(w: World): void;
}

const RESISTS: readonly { id: ResistName; name: string }[] = [
  { id: 'fire', name: '화염' },
  { id: 'cold', name: '냉기' },
  { id: 'electric', name: '전기' },
  { id: 'poison', name: '독' },
  { id: 'negative', name: '음에너지' },
];

function effectLine(w: World, id: SlotId): string {
  const data = slotData(id);
  if (id === 'weapon') return w.weapon.kind ? `마법 위력 +${data.perLevel}` : `피해 +${data.perLevel}`;
  if (id === 'offhand') return w.gear.offhand?.startsWith('spellbook_') ? `마법서 위력 +${data.perLevel}` : `막기 +${data.perLevel * 2}%p`;
  if (id === 'body') return `AC +${data.perLevel}`;
  if (id === 'helmet') return `최대 HP +${data.perLevel}`;
  if (id === 'gloves') return `공격 간격 −${data.perLevel * 100}%`;
  if (id === 'boots') return `이동 속도 +${data.perLevel * 100}%`;
  if (id === 'cloak') return `회피 +${data.perLevel * 100}%p`;
  if (id === 'amulet') return `최대 MP +${data.perLevel}`;
  const chosen = w.hero.ringResist[id as RingSlotId];
  return (RESISTS.find((entry) => entry.id === chosen)?.name ?? '저항 선택') + ` +${data.perLevel}단계`;
}

export function makeSlotPicker(root: HTMLElement, atlas: Atlas): SlotPicker {
  const wrap = document.createElement('section');
  wrap.className = 'slot-picker';
  const title = document.createElement('h2');
  title.textContent = '부위 강화';
  const hint = document.createElement('p');
  hint.textContent = '강화할 부위를 고른 뒤 확인하세요.';
  const layout = document.createElement('div');
  layout.className = 'slot-layout';
  const portrait = document.createElement('div');
  portrait.className = 'slot-doll';
  layout.append(portrait);
  const buttons = new Map<SlotId, HTMLButtonElement>();
  for (const data of SLOTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot-button slot-' + data.id;
    button.addEventListener('click', () => select(data.id));
    buttons.set(data.id, button);
    layout.append(button);
  }
  const resistWrap = document.createElement('div');
  resistWrap.className = 'slot-resists';
  const resistButtons = new Map<ResistName, HTMLButtonElement>();
  for (const resist of RESISTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = resist.name;
    button.addEventListener('click', () => {
      selectedResist = resist.id;
      render();
    });
    resistButtons.set(resist.id, button);
    resistWrap.append(button);
  }
  const confirm = document.createElement('button');
  confirm.type = 'button';
  confirm.className = 'slot-confirm';
  confirm.textContent = '이 부위 강화 확인';
  wrap.append(title, hint, layout, resistWrap, confirm);
  root.append(wrap);

  let world: World | undefined;
  let selected: SlotId | undefined;
  let selectedResist: ResistName | undefined;
  let portraitKey = '';

  const select = (id: SlotId): void => {
    if (!world || world.hero.slotLevels[id] >= slotData(id).cap) return;
    selected = id;
    selectedResist = id === 'ring1' || id === 'ring2' ? world.hero.ringResist[id] : undefined;
    render();
  };
  confirm.addEventListener('click', () => {
    if (!world || !selected) return;
    if (upgradeSlot(world, selected, selectedResist)) {
      selected = undefined;
      selectedResist = undefined;
      render();
    }
  });

  const render = (): void => {
    const w = world;
    if (!w) return;
    const key = [w.weapon.uid, JSON.stringify(w.gear)].join('|');
    if (key !== portraitKey) {
      portraitKey = key;
      const doll = composeDoll(atlas.image, dollLayers(w));
      doll.setAttribute('aria-label', '캐릭터 모습');
      portrait.replaceChildren(doll);
    }
    for (const data of SLOTS) {
      const button = buttons.get(data.id)!;
      const level = w.hero.slotLevels[data.id];
      button.replaceChildren();
      const name = document.createElement('strong');
      name.textContent = data.name + ` +${level}/${data.cap}`;
      const effect = document.createElement('small');
      effect.textContent = effectLine(w, data.id);
      button.append(name, effect);
      button.disabled = level >= data.cap;
      button.classList.toggle('selected', selected === data.id);
    }
    const needsResist = (selected === 'ring1' || selected === 'ring2') && w.hero.slotLevels[selected] === 0;
    resistWrap.classList.toggle('on', needsResist);
    for (const [id, button] of resistButtons) button.classList.toggle('selected', id === selectedResist);
    confirm.disabled = !selected || (needsResist && !selectedResist);
  };

  return {
    show(w) {
      world = w;
      const open = w.pendingRewards[0] === 'slot';
      wrap.classList.toggle('on', open);
      if (!open) {
        selected = undefined;
        selectedResist = undefined;
        return;
      }
      render();
    },
  };
}
