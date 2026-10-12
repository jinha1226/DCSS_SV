import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeWorld } from '../../src/sim/world';
import { makeSpellButtons } from '../../src/ui/spellButtons';

/** Minimal DOM used to exercise button rendering in the Node simulation test suite. */
class Element {
  children: Element[] = [];
  dataset: Record<string, string> = {};
  disabled = false;
  className = '';
  private text = '';
  private classes = new Set<string>();
  classList = {
    toggle: (name: string, enabled: boolean): void => {
      if (enabled) this.classes.add(name);
      else this.classes.delete(name);
    },
    contains: (name: string): boolean => this.classes.has(name),
  };
  set textContent(value: string) {
    this.text = value;
    this.children = [];
  }
  get textContent(): string {
    return this.text + this.children.map((child) => child.textContent).join('');
  }
  append(...children: Element[]): void {
    this.children.push(...children);
  }
  replaceChildren(): void {
    this.children = [];
  }
  addEventListener(): void {}
  querySelector(selector: string): Element | undefined {
    const id = selector.match(/data-spell="([^"]+)"/)?.[1];
    return this.children.find((child) => child.dataset.spell === id);
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('spell button rendering', () => {
  it('labels and disables locked equipment spells, then enables them when the school level rises', () => {
    vi.stubGlobal('document', { createElement: () => new Element() });
    const root = new Element();
    const ui = makeSpellButtons(root as unknown as HTMLElement);
    // Level 1-2 spells need no school skill; a fire book's level 3 spell waits for fire 3.
    const w = makeWorld({ species: 'barachi', job: 'spellblade', monsters: false, items: false });
    w.gear.offhand = 'spellbook_fire_0';
    ui.show(w);
    const wrap = root.children[0]!;
    const locked = wrap.querySelector('[data-spell="ash_cloud"]')!;
    expect(locked.textContent).toContain('잿불구름');
    expect(locked.textContent).toContain('화염술 3 필요');
    expect(locked.disabled).toBe(true);
    expect(locked.classList.contains('locked')).toBe(true);
    expect(wrap.querySelector('[data-spell="searing_line"]')!.disabled).toBe(false);

    w.hero.skills.fire = 3;
    ui.show(w);
    const unlocked = wrap.querySelector('[data-spell="ash_cloud"]')!;
    expect(unlocked.textContent).toContain('7 MP');
    expect(unlocked.disabled).toBe(false);
    expect(unlocked.classList.contains('locked')).toBe(false);
  });
});
