import { itemDefinition } from '../data/itemCatalog';
import { skillData, unlockedPerks } from '../data/skills';
import { itemDisplayName } from '../sim/identification';
import type { SimEvent, World } from '../sim/world';

const PICKUP_SHOW_MS = 1600;
const SKILL_SHOW_MS = 2200;
const MAX_LINES = 4;

type Pickup = Extract<SimEvent, { type: 'pickup' }>;
type Skill = Extract<SimEvent, { type: 'skill' }>;

/** A piece of a line: plain text, or a word picked out in a colour. */
export interface Part {
  readonly text: string;
  readonly tone?: 'item' | 'gold' | 'skill' | 'level' | 'perk';
}

interface Shown {
  readonly key: string;
  readonly node: HTMLElement;
  count: number;
  timer: number;
  perks?: Set<string>;
}

/** What a pickup reads as: the item's name in colour, a count after it when there is more than one. */
export function pickupParts(w: World, e: Pickup, count: number): Part[] {
  if (e.item === 'gold') return [{ text: '금화 ' }, { text: `+${count}`, tone: 'gold' }];
  const name = e.item === 'ammo' ? '부메랑' : e.item === 'consumable' ? itemDisplayName(w, e.id ?? '') : itemDefinition(e.id ?? '').name;
  return [{ text: name, tone: 'item' }, ...(count > 1 ? [{ text: ` ×${count}` }] : [])];
}

/** A skill level-up: the skill and its new level in colour. */
export function skillParts(e: Skill): Part[] {
  return [{ text: skillData(e.id).name, tone: 'skill' }, { text: ' 숙련 ' }, { text: String(e.level), tone: 'level' }];
}

/** Where a point given as fractions of a box (u, v in 0..1) lands on the page, in CSS pixels. */
export function screenFromUnit(
  u: number,
  v: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  return { x: rect.left + u * rect.width, y: rect.top + v * rect.height };
}

function fill(node: HTMLElement, parts: readonly Part[]): void {
  node.replaceChildren(
    ...parts.map((part) => {
      if (!part.tone) return document.createTextNode(part.text);
      const b = document.createElement('b');
      b.className = 'hl-' + part.tone;
      b.textContent = part.text;
      return b;
    }),
  );
}

/**
 * What the hero just picked up or trained, as short lines of text over its head that drift up and fade.
 * No box, no icon: only the words that matter are coloured, so it reads like the log and hides nothing.
 */
export function makePickupToast(root: HTMLElement): {
  take(w: World): void;
  clear(): void;
  /** Keeps the lines over the hero's head: a point in page CSS pixels, or undefined for the default spot. */
  place(anchor: { x: number; y: number } | undefined): void;
} {
  const box = document.createElement('div');
  box.className = 'pickup-toast';
  box.setAttribute('aria-live', 'polite');
  root.append(box);
  let shown: Shown[] = [];

  const drop = (line: Shown): void => {
    line.node.classList.add('leaving');
    window.setTimeout(() => line.node.remove(), 360);
    shown = shown.filter((s) => s !== line);
  };
  const bump = (line: Shown): void => {
    window.clearTimeout(line.timer);
    line.node.classList.remove('bump');
    void line.node.offsetWidth;
    line.node.classList.add('bump');
  };
  const add = (line: Shown, milliseconds: number): Shown => {
    line.node.style.setProperty('--stay', `${milliseconds}ms`);
    box.append(line.node);
    shown.push(line);
    while (shown.length > MAX_LINES) drop(shown[0]!);
    return line;
  };
  const restart = (line: Shown, milliseconds: number): void => {
    const current = line;
    line.timer = window.setTimeout(() => drop(current), milliseconds);
  };
  const showPickup = (w: World, e: Pickup): void => {
    if (e.count <= 0) return;
    const key = e.item === 'gold' || e.item === 'ammo' ? e.item : e.item + ':' + (e.id ?? '');
    let line = shown.find((entry) => entry.key === key);
    if (line) {
      line.count += e.count;
      bump(line);
    } else {
      const node = document.createElement('div');
      node.className = 'pickup-line';
      node.append(document.createElement('span'));
      line = add({ key, node, count: e.count, timer: 0 }, PICKUP_SHOW_MS);
    }
    fill(line.node.firstElementChild as HTMLElement, pickupParts(w, e, line.count));
    restart(line, PICKUP_SHOW_MS);
  };
  const showSkill = (e: Skill): void => {
    const key = 'skill:' + e.id;
    const perks = unlockedPerks(e.id, e.from, e.level);
    let line = shown.find((entry) => entry.key === key);
    const stay = SKILL_SHOW_MS + (perks.length > 0 || (line?.perks?.size ?? 0) > 0 ? 1000 : 0);
    if (line) {
      bump(line);
    } else {
      const node = document.createElement('div');
      node.className = 'pickup-line';
      node.append(document.createElement('span'));
      line = add({ key, node, count: 0, timer: 0, perks: new Set() }, stay);
    }
    fill(line.node.firstElementChild as HTMLElement, skillParts(e));
    for (const perk of perks) {
      if (line.perks!.has(perk)) continue;
      line.perks!.add(perk);
      const note = document.createElement('span');
      note.className = 'pickup-perk';
      fill(note, [{ text: '새 능력 ' }, { text: perk, tone: 'perk' }]);
      line.node.append(note);
    }
    restart(line, stay);
  };

  return {
    take(w) {
      for (const e of w.events) {
        if (e.type === 'pickup') showPickup(w, e);
        if (e.type === 'skill') showSkill(e);
      }
    },
    clear() {
      for (const line of shown) {
        window.clearTimeout(line.timer);
        line.node.remove();
      }
      shown = [];
    },
    place(anchor) {
      box.classList.toggle('anchored', anchor !== undefined);
      if (!anchor) return;
      box.style.left = `${Math.round(anchor.x)}px`;
      box.style.top = `${Math.round(anchor.y)}px`;
    },
  };
}
