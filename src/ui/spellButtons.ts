import { paidSpells } from '../sim/spells';
import type { World } from '../sim/world';

export interface SpellButtons {
  readonly targetingId: string | undefined;
  takePress(): string | undefined;
  beginTarget(id: string): void;
  cancelTarget(): void;
  show(w: World): void;
}

export function makeSpellButtons(root: HTMLElement): SpellButtons {
  const wrap = document.createElement('div');
  wrap.className = 'spell-buttons';
  root.append(wrap);

  let pressed: string | undefined;
  let targeting: string | undefined;
  let key = '';

  const rebuild = (w: World): void => {
    const spells = paidSpells(w);
    const nextKey = spells.map((spell) => spell.id).join('|');
    if (nextKey === key) return;
    key = nextKey;
    wrap.replaceChildren();

    for (const spell of spells) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.spell = spell.id;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        pressed = spell.id;
      });
      wrap.append(button);
    }
  };

  return {
    get targetingId() {
      return targeting;
    },
    takePress() {
      const value = pressed;
      pressed = undefined;
      return value;
    },
    beginTarget(id) {
      targeting = id;
    },
    cancelTarget() {
      targeting = undefined;
    },
    show(w) {
      rebuild(w);
      const spells = paidSpells(w);
      wrap.classList.toggle('on', spells.length > 0);
      for (const spell of spells) {
        const button = wrap.querySelector<HTMLButtonElement>('[data-spell="' + spell.id + '"]');
        if (!button) continue;
        button.disabled = w.hero.mana < spell.mana;
        button.classList.toggle('targeting', targeting === spell.id);
        button.innerHTML =
          '<strong>' +
          spell.name +
          '</strong><span>' +
          spell.mana +
          ' MP</span>';
      }
    },
  };
}
