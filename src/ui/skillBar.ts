import { SKILLS } from '../data/skills';
import type { World } from '../sim/world';

const ICONS: Readonly<Record<string, string>> = {
  fighting: '✦',
  axe: '⚒',
  long_blade: '⚔',
  bow: '➶',
  throwing: '↗',
  conjuration: '✧',
  fire: '♨',
  ice: '❄',
  air: 'ϟ',
  earth: '◆',
  alchemy: '◈',
  hexes: '☽',
  necromancy: '☠',
  summoning: '◎',
  translocation: '⇄',
  forgecraft: '⚙',
  armour: '▣',
  shield: '⬡',
  dodging: '➤',
};

export interface SkillDisplay {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly level: number;
  readonly description: string;
}

/** Learned skills are shown first; opened but untrained skills live in the details only. */
export function listedSkills(w: World, includeUntrained = false): SkillDisplay[] {
  return SKILLS.filter((skill) => {
    const level = w.hero.skills[skill.id] ?? 0;
    return level > 0 || (includeUntrained && w.openSkills.has(skill.id));
  })
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      icon: ICONS[skill.id] ?? '✦',
      level: w.hero.skills[skill.id] ?? 0,
      description: skill.each,
    }))
    .sort((a, b) => (b.level > 0 ? 1 : 0) - (a.level > 0 ? 1 : 0));
}

export interface SkillBar {
  show(w: World): void;
  close(): void;
}

export function makeSkillBar(root: HTMLElement): SkillBar {
  const bar = document.createElement('div');
  bar.className = 'skillbar';
  bar.setAttribute('aria-label', '현재 스킬 레벨');
  const rail = document.createElement('div');
  rail.className = 'skillbar-rail';
  bar.append(rail);
  root.append(bar);

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'skillbar-backdrop';
  backdrop.setAttribute('aria-label', '스킬 정보 닫기');
  root.append(backdrop);

  const drawer = document.createElement('section');
  drawer.className = 'skillbar-drawer';
  drawer.setAttribute('aria-label', '스킬 상세');
  const header = document.createElement('div');
  header.className = 'skillbar-header';
  const heading = document.createElement('strong');
  heading.textContent = '스킬';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'skillbar-close';
  closeButton.textContent = '닫기 ×';
  header.append(heading, closeButton);
  const rows = document.createElement('div');
  rows.className = 'skillbar-list';
  drawer.append(header, rows);
  root.append(drawer);

  let current: World | undefined;
  let open = false;
  let lastBarKey = '';
  let lastDetailKey = '';

  const setOpen = (value: boolean): void => {
    open = value;
    backdrop.classList.toggle('on', open);
    drawer.classList.toggle('on', open);
    bar.classList.toggle('expanded', open);
    if (open) lastDetailKey = '';
  };
  backdrop.addEventListener('click', () => setOpen(false));
  closeButton.addEventListener('click', () => setOpen(false));

  const showDetails = (w: World): void => {
    const skills = listedSkills(w, true);
    const key = skills.map((skill) => skill.id + ':' + skill.level).join('|');
    if (key === lastDetailKey) return;
    lastDetailKey = key;
    rows.replaceChildren();
    for (const skill of skills) {
      const row = document.createElement('div');
      row.className = 'skillbar-row';
      const icon = document.createElement('span');
      icon.className = 'skillbar-row-icon';
      icon.textContent = skill.icon;
      const info = document.createElement('span');
      info.className = 'skillbar-row-info';
      const name = document.createElement('strong');
      name.textContent = skill.name;
      const description = document.createElement('small');
      description.textContent = skill.description;
      info.append(name, description);
      const level = document.createElement('b');
      level.className = 'skillbar-row-level';
      level.textContent = String(skill.level);
      row.append(icon, info, level);
      rows.append(row);
    }
  };

  rail.addEventListener('click', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('.skillbar-chip') || !current) return;
    setOpen(!open);
    if (open) showDetails(current);
  });

  return {
    show(w) {
      if (current !== w) {
        current = w;
        lastBarKey = '';
        lastDetailKey = '';
        setOpen(false);
      }
      const skills = listedSkills(w);
      const key = skills.map((skill) => skill.id + ':' + skill.level).join('|');
      bar.classList.toggle('on', skills.length > 0 && !w.over);
      if (w.over && open) setOpen(false);
      if (key !== lastBarKey) {
        lastBarKey = key;
        rail.replaceChildren();
        for (const skill of skills) {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'skillbar-chip';
          chip.setAttribute('aria-label', skill.name + ' ' + skill.level + '단계, 스킬 상세 보기');
          const icon = document.createElement('span');
          icon.className = 'skillbar-icon';
          icon.textContent = skill.icon;
          const level = document.createElement('span');
          level.className = 'skillbar-level';
          level.textContent = String(skill.level);
          chip.append(icon, level);
          rail.append(chip);
        }
      }
      if (open) showDetails(w);
    },
    close() {
      setOpen(false);
      current = undefined;
    },
  };
}
