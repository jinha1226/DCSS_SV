import { CHARACTERS, type CharacterData } from '../data/characters';
import { heroFor } from '../data/hero';
import { drawTile, type Atlas } from '../view/atlas';

export interface CharacterSelect {
  show(): void;
  hide(): void;
}

export function makeCharacterSelect(root: HTMLElement, atlas: Atlas, choose: (character: CharacterData) => void): CharacterSelect {
  const wrap = document.createElement('div');
  wrap.className = 'character-select';
  const title = document.createElement('h1');
  title.textContent = '캐릭터 고르기';
  wrap.append(title);
  const cards = document.createElement('div');
  cards.className = 'character-cards';
  wrap.append(cards);
  root.append(wrap);

  for (const character of CHARACTERS) {
    const hero = heroFor(character.species, character.job);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-card';
    const portrait = document.createElement('canvas');
    portrait.width = 96;
    portrait.height = 96;
    const ctx = portrait.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      drawTile(ctx, atlas.image, hero.tile, 0, 0, 96);
    }
    const name = document.createElement('strong');
    name.textContent = character.name;
    const tagline = document.createElement('span');
    tagline.textContent = character.tagline;
    button.append(portrait, name, tagline);
    button.addEventListener('click', () => choose(character));
    cards.append(button);
  }

  return {
    show() {
      wrap.classList.add('on');
    },
    hide() {
      wrap.classList.remove('on');
    },
  };
}
