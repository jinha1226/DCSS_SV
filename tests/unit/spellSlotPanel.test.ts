import { afterEach, describe, expect, it, vi } from 'vitest';
import { plainWeapon } from '../../src/data/items';
import { spellSlots } from '../../src/sim/spellAccess';
import { makeWorld } from '../../src/sim/world';
import { makeSpellSlotPanel } from '../../src/ui/spellSlotPanel';

/** Minimal DOM: enough to render rows and fire click handlers in Node. */
class Element {
  children: Element[] = [];
  className = '';
  textContent = '';
  type = '';
  private classes = new Set<string>();
  private handlers: (() => void)[] = [];
  classList = {
    toggle: (name: string, enabled: boolean): void => {
      if (enabled) this.classes.add(name);
      else this.classes.delete(name);
    },
    contains: (name: string): boolean => this.classes.has(name),
  };
  append(...children: Element[]): void {
    this.children.push(...children);
  }
  replaceChildren(): void {
    this.children = [];
  }
  setAttribute(): void {}
  addEventListener(_: string, handler: () => void): void {
    this.handlers.push(handler);
  }
  click(): void {
    for (const handler of this.handlers) handler();
  }
}

afterEach(() => vi.unstubAllGlobals());

const rowFor = (panel: Element, name: string): Element => panel.children.find((row) => row.children[0]?.textContent.includes(name))!;

describe('spell slot panel', () => {
  it('shows each equipped button spell with four slot buttons and pins on click', () => {
    vi.stubGlobal('document', { createElement: () => new Element() });
    const panel = makeSpellSlotPanel();
    const w = makeWorld({ species: 'deep_elf', job: 'earth_mage', items: false, monsters: false });
    w.weapon = plainWeapon('staff_earth_2');
    w.hero.skills.earth = 27;
    panel.render(w);
    const element = panel.element as unknown as Element;
    expect(element.children[0]!.textContent).toBe('마법 버튼');
    const row = rowFor(element, '충격파');
    expect(row.children).toHaveLength(5);
    expect(row.children[4]!.classList.contains('on')).toBe(true);

    row.children[1]!.click();
    expect(w.hero.spellSlots[0]).toBe('pulse_burst');
    expect(spellSlots(w)[0]?.id).toBe('pulse_burst');
    const pinned = rowFor(element, '충격파').children[1]!;
    expect(pinned.classList.contains('pinned')).toBe(true);

    pinned.click();
    expect(w.hero.spellSlots[0]).toBeUndefined();
  });

  it('marks locked spells with the school level they need and stays empty without magic gear', () => {
    vi.stubGlobal('document', { createElement: () => new Element() });
    const panel = makeSpellSlotPanel();
    const w = makeWorld({ species: 'deep_elf', job: 'earth_mage', items: false, monsters: false });
    w.weapon = plainWeapon('staff_earth_2');
    w.hero.skills.earth = 0;
    panel.render(w);
    const locked = rowFor(panel.element as unknown as Element, '산사태').children[0]!;
    expect(locked.textContent).toContain('대지술 21');
    expect(locked.className).toBe('muted');

    const fighter = makeWorld({ species: 'minotaur', job: 'berserker', items: false, monsters: false });
    panel.render(fighter);
    expect((panel.element as unknown as Element).children).toHaveLength(0);
  });
});
