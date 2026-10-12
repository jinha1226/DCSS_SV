import { paidSpells, lockedSpells, requiredLevel } from '../sim/spells';
import { skillData } from '../data/skills';
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
    const spells = [...paidSpells(w), ...lockedSpells(w)];
    const nextKey = spells.map((spell) => spell.id + ':' + ((w.hero.skills[spell.school] ?? 0) >= requiredLevel(spell))).join('|');
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
      wrap.classList.toggle('with-hop', w.heroDef.species === 'barachi');
      for (const spell of spells) {
        const button = wrap.querySelector<HTMLButtonElement>('[data-spell="' + spell.id + '"]');
        if (!button) continue;
        const locked = (w.hero.skills[spell.school] ?? 0) < requiredLevel(spell);
        button.disabled = locked || w.hero.mana < spell.mana || w.hero.spellCooldown > 0;
        button.classList.toggle('targeting', targeting === spell.id);
        button.textContent = '';
        const name = document.createElement('strong');
        name.textContent = spell.name;
        const detail = document.createElement('span');
        detail.textContent = locked ? skillData(spell.school).name + ' ' + requiredLevel(spell) + ' 필요' : spell.mana + ' MP';
        button.classList.toggle('locked', locked);
        button.append(name, detail);
      }
    },
  };
}
