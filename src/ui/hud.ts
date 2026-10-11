import { skillData } from '../data/skills';
import { xpToNext } from '../sim/skills';
import type { World } from '../sim/world';

export interface Hud {
  show(w: World): void;
}

function el(tag: string, className: string, parent: HTMLElement): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  parent.append(node);
  return node;
}

const clock = (seconds: number): string => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');

function skillText(w: World): string {
  return Object.entries(w.hero.skills)
    .filter(([, level]) => level > 0)
    .map(([id, level]) => skillData(id).name + ' ' + level)
    .join(' · ');
}

export function makeHud(root: HTMLElement, again: () => void, chooseCharacter: () => void): Hud {
  const top = el('div', 'top', root);
  const vitals = el('div', 'vitals', top);
  const bar = el('div', 'hp', vitals);
  const fill = el('div', 'hp-fill', bar);
  const hpText = el('div', 'hp-text', bar);
  const mana = el('div', 'mana', vitals);
  const manaFill = el('div', 'mana-fill', mana);
  const manaText = el('div', 'mana-text', mana);
  const levelRow = el('div', 'level-row', vitals);
  const levelText = el('span', 'level-text', levelRow);
  const xp = el('div', 'xp', levelRow);
  const xpFill = el('div', 'xp-fill', xp);
  const stats = el('div', 'stats', top);

  const over = el('div', 'over', root);
  const title = el('h1', '', over);
  const result = el('p', '', over);
  const skills = el('p', 'result-skills', over);
  const againButton = el('button', '', over) as HTMLButtonElement;
  againButton.type = 'button';
  againButton.textContent = '같은 캐릭터로 다시';
  const chooseButton = el('button', '', over) as HTMLButtonElement;
  chooseButton.type = 'button';
  chooseButton.textContent = '캐릭터 고르기';

  let shownAt = 0;
  const ready = (): boolean => performance.now() - shownAt >= 400;
  againButton.addEventListener('click', () => {
    if (ready()) again();
  });
  chooseButton.addEventListener('click', () => {
    if (ready()) chooseCharacter();
  });

  let last = '';
  let shown = false;
  return {
    show(w) {
      const hp = Math.ceil(w.hero.hp);
      const need = xpToNext(w.hero.level);
      const line = [
        hp,
        Math.floor(w.hero.mana * 10),
        Math.floor(w.time),
        w.kills,
        w.depth,
        w.hero.poison > 0,
        w.hero.level,
        w.hero.xp,
        need,
      ].join('|');
      if (line !== last) {
        last = line;
        fill.style.width = (Math.max(0, w.hero.hp) / w.hero.maxHp) * 100 + '%';
        bar.classList.toggle('poison', w.hero.poison > 0);
        bar.classList.toggle('low', w.hero.hp <= w.hero.maxHp * 0.3);
        hpText.textContent = hp + ' / ' + w.hero.maxHp;
        mana.classList.toggle('on', w.hero.maxMana > 0);
        manaFill.style.width = (w.hero.maxMana > 0 ? w.hero.mana / w.hero.maxMana : 0) * 100 + '%';
        manaText.textContent = Math.floor(w.hero.mana) + ' / ' + w.hero.maxMana;
        levelText.textContent = 'Lv ' + w.hero.level;
        xpFill.style.width = Math.min(1, w.hero.xp / need) * 100 + '%';
        stats.textContent = w.depth + '/3층 · ' + clock(w.time) + ' · 처치 ' + w.kills;
      }
      if (w.over !== shown) {
        shown = w.over;
        if (w.over) shownAt = performance.now();
        title.textContent = w.won ? '던전을 빠져나왔다' : '쓰러졌다';
        result.textContent = w.depth + '층 · ' + clock(w.time) + ' · ' + w.kills + ' 처치 · Lv ' + w.hero.level;
        skills.textContent = (skillText(w) || '고른 스킬 없음') + ' · 무기 ' + w.weapon.name;
        over.classList.toggle('on', w.over);
      }
      const buttonsReady = !w.over || ready();
      againButton.disabled = !buttonsReady;
      chooseButton.disabled = !buttonsReady;
    },
  };
}
