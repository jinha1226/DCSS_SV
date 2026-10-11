import { brandData, type AxeItem } from '../data/items';
import { acceptPickup, declinePickup } from '../sim/equipment';
import type { World } from '../sim/world';

export interface EquipmentPicker {
  show(w: World): void;
}

function line(parent: HTMLElement, label: string, current: string, found: string, better: number): void {
  const row = document.createElement('div');
  row.className = 'gear-line';
  const key = document.createElement('span');
  key.textContent = label;
  const a = document.createElement('span');
  a.textContent = current;
  const b = document.createElement('span');
  b.textContent = found;
  b.className = better > 0 ? 'better' : better < 0 ? 'worse' : '';
  row.append(key, a, b);
  parent.append(row);
}
const brand = (axe: AxeItem): string => brandData(axe.brand)?.name ?? '없음';
const options = (axe: AxeItem): string =>
  axe.options.length
    ? axe.options.map((o) => o.name + ' ' + (o.value < 1 ? Math.round(o.value * 100) + '%' : '+' + o.value)).join(', ')
    : '없음';

export function makeEquipmentPicker(root: HTMLElement): EquipmentPicker {
  const wrap = document.createElement('div');
  wrap.className = 'gear-picker';
  root.append(wrap);
  const title = document.createElement('h2');
  title.textContent = '도끼를 발견했다';
  wrap.append(title);
  const heads = document.createElement('div');
  heads.className = 'gear-heads';
  heads.innerHTML = '<b>항목</b><b>지금</b><b>주운 것</b>';
  wrap.append(heads);
  const body = document.createElement('div');
  body.className = 'gear-body';
  wrap.append(body);
  const note = document.createElement('div');
  note.className = 'gear-note';
  wrap.append(note);
  const actions = document.createElement('div');
  actions.className = 'gear-actions';
  wrap.append(actions);
  const swap = document.createElement('button');
  swap.type = 'button';
  swap.textContent = '바꾸기';
  const leave = document.createElement('button');
  leave.type = 'button';
  leave.textContent = '두고 가기';
  actions.append(swap, leave);
  let current: World | undefined,
    shownAt = 0,
    key = '';
  const act = (fn: (w: World) => void): void => {
    if (!current || performance.now() - shownAt < 400) return;
    fn(current);
  };
  swap.addEventListener('click', () => act(acceptPickup));
  leave.addEventListener('click', () => act(declinePickup));
  return {
    show(w) {
      current = w;
      const found = w.pendingPickup?.axe;
      wrap.classList.toggle('on', Boolean(found));
      if (!found) return;
      const next = w.pendingPickup!.uid;
      if (next !== key) {
        key = next;
        shownAt = performance.now();
        body.replaceChildren();
        const now = w.weapon;
        line(body, '이름', now.name, found.name, 0);
        line(body, '피해', String(now.damage), String(found.damage), found.damage - now.damage);
        line(body, '간격', now.every.toFixed(2) + '초', found.every.toFixed(2) + '초', now.every - found.every);
        line(
          body,
          '손',
          now.hands === 2 ? '양손' : '한손',
          found.hands === 2 ? '양손' : '한손',
          now.hands === 2 && found.hands === 1 ? 1 : now.hands === 1 && found.hands === 2 ? -1 : 0,
        );
        line(body, '속성', brand(now), brand(found), found.brand && !now.brand ? 1 : 0);
        line(body, '옵션', options(now), options(found), found.options.length - now.options.length);
        note.textContent = found.hands === 2 ? '양손: 들고 있는 동안 방패 스킬이 쉰다.' : found.special ? '특별한 도끼다.' : '';
      }
      const ready = performance.now() - shownAt >= 400;
      swap.disabled = !ready;
      leave.disabled = !ready;
    },
  };
}
