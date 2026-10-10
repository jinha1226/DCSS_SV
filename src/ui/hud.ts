import type { World } from '../sim/world';

export interface Hud {
  /** Shows the world as it stands. Cheap to call every frame. */
  show(w: World): void;
}

function el(tag: string, className: string, parent: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
}

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

/** The strip at the top (health, time, kills) and the screen shown when the hero has fallen. */
export function makeHud(root: HTMLElement, again: () => void): Hud {
  const top = el('div', 'top', root);
  const bar = el('div', 'hp', top);
  const fill = el('div', 'hp-fill', bar);
  const hpText = el('div', 'hp-text', bar);
  const stats = el('div', 'stats', top);

  const over = el('div', 'over', root);
  const title = el('h1', '', over);
  title.textContent = '쓰러졌다';
  const result = el('p', '', over);
  const button = el('button', '', over) as HTMLButtonElement;
  button.type = 'button';
  button.textContent = '다시 시작';
  button.addEventListener('click', again);

  let last = '';
  let shown = false;
  return {
    show(w) {
      const hp = Math.ceil(w.hero.hp);
      const line = `${hp}|${Math.floor(w.time)}|${w.kills}`;
      if (line !== last) {
        last = line;
        fill.style.width = `${(Math.max(0, w.hero.hp) / w.hero.maxHp) * 100}%`;
        bar.classList.toggle('low', w.hero.hp <= w.hero.maxHp * 0.3);
        hpText.textContent = `${hp} / ${w.hero.maxHp}`;
        stats.textContent = `${clock(w.time)} · 처치 ${w.kills}`;
      }
      if (w.over !== shown) {
        shown = w.over;
        result.textContent = `${clock(w.time)} 버팀 · ${w.kills} 처치`;
        over.classList.toggle('on', w.over);
      }
    },
  };
}
