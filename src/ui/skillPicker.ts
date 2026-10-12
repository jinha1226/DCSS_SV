import { skillData } from '../data/skills';
import { chooseReward, skipReward } from '../sim/rewards';
import type { World } from '../sim/world';

export interface SkillPicker {
  show(w: World): void;
}

export function makeSkillPicker(root: HTMLElement): SkillPicker {
  const wrap = document.createElement('div');
  wrap.className = 'skill-picker';
  root.append(wrap);
  const title = document.createElement('h2');
  title.textContent = '레벨업 · 아이템 선택';
  wrap.append(title);
  const cards = document.createElement('div');
  cards.className = 'skill-cards';
  wrap.append(cards);
  const skip = document.createElement('div');
  skip.className = 'reward-skip';
  const skipHeal = document.createElement('button');
  skipHeal.textContent = '건너뛰기: 회복';
  const skipGold = document.createElement('button');
  skipGold.textContent = '건너뛰기: 금화';
  for (const button of [skipHeal, skipGold]) button.type = 'button';
  skip.append(skipHeal, skipGold);
  wrap.append(skip);
  const owned = document.createElement('div');
  owned.className = 'skill-owned';
  wrap.append(owned);

  let key = '';
  let shownAt = 0;
  let current: World | undefined;

  skipHeal.addEventListener('click', () => {
    if (current && performance.now() - shownAt >= 400) skipReward(current, 'heal');
  });
  skipGold.addEventListener('click', () => {
    if (current && performance.now() - shownAt >= 400) skipReward(current, 'gold');
  });

  return {
    show(w) {
      current = w;
      const choices = w.rewardChoices;
      wrap.classList.toggle('on', Boolean(choices));
      if (!choices) return;
      const nextKey = choices.map((c) => c.id).join('|');
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
          level.textContent = card.kind === 'weapon' ? '무기' : card.kind === 'gear' ? '장비' : '소모품';
          const line = document.createElement('small');
          line.textContent = card.line;
          button.append(name, level, line);
          button.addEventListener('click', () => {
            if (performance.now() - shownAt < 400 || !current) return;
            chooseReward(current, card.id);
          });
          cards.append(button);
        }
      }
      const ready = performance.now() - shownAt >= 400;
      skipHeal.disabled = skipGold.disabled = !ready;
      for (const node of cards.querySelectorAll<HTMLButtonElement>('button')) node.disabled = !ready;
      const list = Object.entries(w.hero.skills)
        .filter(([, level]) => level > 0)
        .map(([id, level]) => skillData(id).name + ' ' + level)
        .join(' · ');
      owned.textContent = list ? '현재: ' + list : '현재: 없음';
    },
  };
}
