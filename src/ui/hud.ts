import { skillData } from '../data/skills';
import { xpToNext } from '../sim/skills';
import { downDestinations, nodeLabel } from '../sim/dungeonGraph';
import { shopAccessible } from '../sim/branchLoot';
import { Cell, cellAt } from '../sim/grid';
import type { World } from '../sim/world';

export interface Hud {
  readonly minimap: HTMLCanvasElement;
  readonly menuSlot: HTMLElement;
  readonly skillSlot: HTMLElement;
  closeMenu(): void;
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
  const header = el('div', 'hud-header', top);
  const minimap = document.createElement('canvas');
  minimap.className = 'hud-minimap';
  minimap.width = 120;
  minimap.height = 120;
  minimap.setAttribute('aria-label', '탐험한 던전 미니맵');
  header.append(minimap);

  const location = el('div', 'hud-location', header);
  const place = el('strong', 'hud-place', location);
  const elapsed = el('span', 'hud-time', location);
  const menuArea = el('div', 'hud-menu-area', header);
  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.className = 'hud-menu-button';
  menuButton.textContent = '☰';
  menuButton.setAttribute('aria-label', '메뉴 열기');
  menuButton.setAttribute('aria-expanded', 'false');
  menuArea.append(menuButton);
  const menuSlot = el('div', 'hud-menu-popup', menuArea);
  menuSlot.classList.add('hidden');
  const closeMenu = (): void => {
    menuSlot.classList.add('hidden');
    menuButton.setAttribute('aria-expanded', 'false');
  };
  menuButton.addEventListener('click', () => {
    const opening = menuSlot.classList.contains('hidden');
    menuSlot.classList.toggle('hidden', !opening);
    menuButton.setAttribute('aria-expanded', String(opening));
  });

  const vitals = el('div', 'vitals', top);
  const bar = el('div', 'hp', vitals);
  const fill = el('div', 'hp-fill', bar);
  const hpText = el('div', 'hp-text', bar);
  const mana = el('div', 'mana', vitals);
  const manaFill = el('div', 'mana-fill', mana);
  const manaText = el('div', 'mana-text', mana);
  const levelRow = el('div', 'level-row', vitals);
  const xp = el('div', 'xp', levelRow);
  const xpFill = el('div', 'xp-fill', xp);
  const levelText = el('span', 'level-text', xp);
  const skillSlot = el('div', 'hud-skill-slot', top);

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
    minimap,
    menuSlot,
    skillSlot,
    closeMenu,
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
        [...w.runes].sort().join(','),
        w.orbCollected,
        w.gold,
        shopAccessible(w),
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
        const location = w.dungeonGraph.nodes.get(w.depth);
        place.textContent =
          location?.branch === 'Dungeon'
            ? '지하 ' + location.floor + '층'
            : (location?.branch ?? 'Dungeon') + ' ' + (location?.floor ?? w.depth) + '층';
        const cell = cellAt(w.grid, Math.floor(w.hero.x), Math.floor(w.hero.y));
        if (cell === Cell.StairsDown) {
          const stairs = w.stairs.filter((stair) => stair.down);
          const index = stairs.findIndex((stair) => stair.x === Math.floor(w.hero.x) && stair.y === Math.floor(w.hero.y));
          const targets = downDestinations(w.dungeonGraph, w.depth);
          const target = w.dungeonGraph.nodes.get(targets[index] ?? targets[0] ?? -1);
          if (target) {
            place.textContent += ' → ' + nodeLabel(target);
            if (target.branch === 'Zot' && w.runes.size < 2) place.textContent += ' (룬 2개 필요)';
          }
        }
        if (shopAccessible(w)) place.textContent += ' · 상점 이용 가능';
        elapsed.textContent = clock(w.time) + ' · 룬 ' + w.runes.size + '/2 · 금화 ' + w.gold + ' · 처치 ' + w.kills;
      }
      if (w.over !== shown) {
        if (w.over) closeMenu();
        shown = w.over;
        if (w.over) shownAt = performance.now();
        title.textContent = w.won ? '조트의 보주를 획득했다' : '쓰러졌다';
        result.textContent =
          (w.dungeonGraph.nodes.get(w.depth)?.branch ?? 'Dungeon') +
          ' ' +
          (w.dungeonGraph.nodes.get(w.depth)?.floor ?? w.depth) +
          '층 · ' +
          clock(w.time) +
          ' · ' +
          w.kills +
          ' 처치 · Lv ' +
          w.hero.level;
        skills.textContent = (skillText(w) || '고른 스킬 없음') + ' · 무기 ' + w.weapon.name;
        over.classList.toggle('on', w.over);
      }
      const buttonsReady = !w.over || ready();
      againButton.disabled = !buttonsReady;
      chooseButton.disabled = !buttonsReady;
    },
  };
}
