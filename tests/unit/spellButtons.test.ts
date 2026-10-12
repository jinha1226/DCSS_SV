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
    const w = makeWorld({ species: 'barachi', job: 'spellblade', monsters: false, items: false });
    ui.show(w);
    const wrap = root.children[0]!;
    const locked = wrap.querySelector('[data-spell="phase_guard"]')!;
    expect(locked.textContent).toContain('위상막');
    expect(locked.textContent).toContain('주술 3 필요');
    expect(locked.disabled).toBe(true);
    expect(locked.classList.contains('locked')).toBe(true);
    expect(wrap.querySelector('[data-spell="blink_step"]')!.disabled).toBe(false);

    w.hero.skills.hexes = 3;
    ui.show(w);
    const unlocked = wrap.querySelector('[data-spell="phase_guard"]')!;
    expect(unlocked.textContent).toContain('6 MP');
    expect(unlocked.disabled).toBe(false);
    expect(unlocked.classList.contains('locked')).toBe(false);
  });
});
