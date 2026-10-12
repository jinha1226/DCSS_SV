import type { SpellData } from '../data/spells';
import { skillData } from '../data/skills';
import { SPELL_SLOTS, knownSpells, lockedSpells, requiredLevel, setSpellSlot, spellSlots } from '../sim/spellAccess';
import type { World } from '../sim/world';

export interface SpellSlotPanel {
  readonly element: HTMLElement;
  /** A string that changes whenever the panel would look different. */
  key(w: World): string;
  render(w: World): void;
}

function equippedButtons(w: World): SpellData[] {
  return [...knownSpells(w), ...lockedSpells(w)].sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));
}

/** Lists the equipped button spells and lets the player pin each one to one of the four buttons. */
export function makeSpellSlotPanel(): SpellSlotPanel {
  const element = document.createElement('div');
  element.className = 'status-spells';

  const render = (w: World): void => {
    element.replaceChildren();
    const spells = equippedButtons(w);
    if (!spells.length) return;
    const title = document.createElement('h3');
    title.textContent = '마법 버튼';
    element.append(title);
    const slots = spellSlots(w);
    const locked = new Set(lockedSpells(w).map((spell) => spell.id));
    for (const spell of spells) {
      const row = document.createElement('div');
      row.className = 'spell-slot-row';
      const name = document.createElement('span');
      name.textContent =
        spell.level +
        '. ' +
        spell.name +
        (locked.has(spell.id) ? ' (' + skillData(spell.school).name + ' ' + requiredLevel(spell) + ')' : '');
      if (locked.has(spell.id)) name.className = 'muted';
      row.append(name);
      for (let index = 0; index < SPELL_SLOTS; index++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = String(index + 1);
        const here = slots[index]?.id === spell.id;
        const pinned = w.hero.spellSlots[index] === spell.id;
        button.classList.toggle('on', here);
        button.classList.toggle('pinned', pinned);
        button.setAttribute('aria-label', spell.name + ' → ' + (index + 1) + '번 버튼');
        button.addEventListener('click', () => {
          setSpellSlot(w, index, pinned ? undefined : spell.id);
          render(w);
        });
        row.append(button);
      }
      element.append(row);
    }
  };

  return {
    element,
    key(w) {
      return (
        equippedButtons(w)
          .map((spell) => spell.id)
          .join(',') +
        '/' +
        w.hero.spellSlots.join(',') +
        '/' +
        lockedSpells(w)
          .map((spell) => spell.id)
          .join(',')
      );
    },
    render,
  };
}
