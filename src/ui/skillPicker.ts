import { skillData } from '../data/skills';
import { chooseSkill } from '../sim/skills';
import type { World } from '../sim/world';

export interface SkillPicker {
  show(w: World): void;
}

export function makeSkillPicker(root: HTMLElement): SkillPicker {
  const wrap = document.createElement('div');
  wrap.className = 'skill-picker';
  root.append(wrap);
  const title = document.createElement('h2');
  title.textContent = '스킬 선택';
  wrap.append(title);
  const cards = document.createElement('div');
  cards.className = 'skill-cards';
  wrap.append(cards);
  const owned = document.createElement('div');
  owned.className = 'skill-owned';
  wrap.append(owned);

  let key = '';
  let shownAt = 0;
  let current: World | undefined;

  return {
    show(w) {
      current = w;
      const choices = w.choosing;
      wrap.classList.toggle('on', Boolean(choices));
      if (!choices) return;
      const nextKey = choices.map((c) => c.id + ':' + c.to).join('|');
      if (nextKey !== key) {
        key = nextKey;
        shownAt = performance.now();
        cards.replaceChildren();
        for (const card of choices) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'skill-card';
          button.disabled = true;
          const name = document.createElement('strong');
          name.textContent = card.name;
          const level = document.createElement('span');
          const badges = [card.gain > 1 ? '+' + card.gain : '', card.cap < 8 ? '최대 ' + card.cap : ''].filter(Boolean);
          level.textContent = card.from + ' → ' + card.to + '단계' + (badges.length ? ' · ' + badges.join(' · ') : '');
          const line = document.createElement('small');
          line.textContent = card.line;
          button.append(name, level, line);
          button.addEventListener('click', () => {
            if (performance.now() - shownAt < 400 || !current) return;
            chooseSkill(current, card.id);
          });
          cards.append(button);
        }
      }
      const ready = performance.now() - shownAt >= 400;
      for (const node of cards.querySelectorAll<HTMLButtonElement>('button')) node.disabled = !ready;
      const list = Object.entries(w.hero.skills)
        .filter(([, level]) => level > 0)
        .map(([id, level]) => skillData(id).name + ' ' + level)
        .join(' · ');
      owned.textContent = list ? '현재: ' + list : '현재: 없음';
    },
  };
}
