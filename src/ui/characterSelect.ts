import jobsRaw from '../data/json/jobs.json';
import speciesRaw from '../data/json/species.json';
import { weaponBase } from '../data/items';
import { skillData } from '../data/skills';
import { drawTile, type Atlas } from '../view/atlas';

export interface CharacterChoice {
  readonly species: string;
  readonly job: string;
}

export interface CharacterSelect {
  show(): void;
  hide(): void;
}

const APTITUDE_NAMES: Readonly<Record<string, string>> = {
  fighting: '전투',
  armour: '갑옷',
  shield: '방패',
  dodging: '회피',
  axe: '도끼',
  long_blade: '장검',
  bow: '활',
  throwing: '투척',
  magic: '마법',
};

const APTITUDE_VALUES = {
  good: '좋음',
  normal: '보통',
  bad: '나쁨',
} as const;

export function makeCharacterSelect(root: HTMLElement, atlas: Atlas, choose: (choice: CharacterChoice) => void): CharacterSelect {
  const wrap = document.createElement('div');
  wrap.className = 'character-select';
  const title = document.createElement('h1');
  const cards = document.createElement('div');
  cards.className = 'character-cards';
  wrap.append(title, cards);
  root.append(wrap);

  let selectedSpecies: (typeof speciesRaw)[number] | undefined;

  const drawPortrait = (tile: string): HTMLCanvasElement => {
    const portrait = document.createElement('canvas');
    portrait.width = 96;
    portrait.height = 96;
    const ctx = portrait.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      drawTile(ctx, atlas.image, tile as Parameters<typeof drawTile>[2], 0, 0, 96);
    }
    return portrait;
  };

  const showJobs = (): void => {
    if (!selectedSpecies) return;
    title.textContent = selectedSpecies.name + ' · 직업 선택';
    cards.replaceChildren();

    for (const job of jobsRaw) {
      const weapon = weaponBase(job.startingWeapon);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-card job-card';

      const portrait = drawPortrait(weapon.tile);
      const name = document.createElement('strong');
      name.textContent = job.name;

      const details = document.createElement('span');
      details.className = 'choice-details';
      const skills = Object.entries(job.startingSkills)
        .filter(([, level]) => typeof level === 'number' && level > 0)
        .map(([id, level]) => skillData(id).name + ' ' + level)
        .join(' · ');
      const items = [weapon.name, job.startingAmmo > 0 ? '부메랑 ×' + job.startingAmmo : ''].filter(Boolean).join(' · ');
      details.innerHTML = '<b>시작 아이템</b> ' + items + '<br><b>시작 스킬</b> ' + skills;

      button.append(portrait, name, details);
      button.addEventListener('click', () => choose({ species: selectedSpecies!.id, job: job.id }));
      cards.append(button);
    }

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'choice-back';
    back.textContent = '← 종족 다시 고르기';
    back.addEventListener('click', showSpecies);
    cards.append(back);
  };

  const showSpecies = (): void => {
    selectedSpecies = undefined;
    title.textContent = '종족 선택';
    cards.replaceChildren();

    for (const species of speciesRaw) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'character-card species-card';

      const portrait = drawPortrait(species.tile);
      const name = document.createElement('strong');
      name.textContent = species.name;

      const aptitudes = document.createElement('span');
      aptitudes.className = 'aptitude-grid';
      for (const [id, value] of Object.entries(species.aptitudes)) {
        const row = document.createElement('span');
        row.className = 'aptitude aptitude-' + value;
        row.textContent = (APTITUDE_NAMES[id] ?? id) + ' ' + APTITUDE_VALUES[value as keyof typeof APTITUDE_VALUES];
        aptitudes.append(row);
      }

      button.append(portrait, name, aptitudes);
      button.addEventListener('click', () => {
        selectedSpecies = species;
        showJobs();
      });
      cards.append(button);
    }
  };

  showSpecies();

  return {
    show() {
      showSpecies();
      wrap.classList.add('on');
    },
    hide() {
      wrap.classList.remove('on');
    },
  };
}
