import { itemDefinition } from '../data/itemCatalog';
import { skillData, unlockedPerks } from '../data/skills';
import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import { itemDisplayName, itemTile } from '../sim/identification';
import type { SimEvent, World } from '../sim/world';
import type { Atlas } from '../view/atlas';
import { SKILL_ICONS } from './skillBar';

const PICKUP_SHOW_MS = 1600;
const SKILL_SHOW_MS = 2200;
const MAX_LINES = 4;

type Pickup = Extract<SimEvent, { type: 'pickup' }>;
type Skill = Extract<SimEvent, { type: 'skill' }>;

interface Shown {
  readonly key: string;
  readonly node: HTMLElement;
  count: number;
  timer: number;
  perks?: Set<string>;
}

function describe(w: World, e: Pickup): { key: string; name: string; tile?: TileName } {
  if (e.item === 'gold') return { key: 'gold', name: '금화', tile: 'item/gold' as TileName };
  if (e.item === 'ammo') return { key: 'ammo', name: '부메랑', tile: 'item/boomerang1' as TileName };
  const id = e.id ?? '';
  const tile = (e.item === 'consumable' ? itemTile(w, id) : itemDefinition(id).tile) as TileName | undefined;
  const name = e.item === 'consumable' ? itemDisplayName(w, id) : itemDefinition(id).name;
  return { key: e.item + ':' + id, name, ...(tile ? { tile } : {}) };
}

function icon(atlas: Atlas, tile: TileName | undefined): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  c.className = 'pickup-icon';
  if (!tile) return c;
  try {
    const at = tileRect(tile);
    c.getContext('2d')?.drawImage(atlas.image, at.x, at.y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  } catch {
    // A tile the sheet lacks: the line shows without its picture.
  }
  return c;
}

/**
 * What the hero just picked up or trained, shown for a moment over the middle of the game view.
 */
export function makePickupToast(root: HTMLElement, atlas: Atlas): { take(w: World): void; clear(): void } {
  const box = document.createElement('div');
  box.className = 'pickup-toast';
  box.setAttribute('aria-live', 'polite');
  root.append(box);
  let shown: Shown[] = [];

  const label = (name: string, count: number, gold: boolean): string => (gold ? `금화 +${count}` : count > 1 ? `${name} ×${count}` : name);
  const drop = (line: Shown): void => {
    line.node.classList.add('leaving');
    window.setTimeout(() => line.node.remove(), 260);
    shown = shown.filter((s) => s !== line);
  };
  const bump = (line: Shown): void => {
    window.clearTimeout(line.timer);
    line.node.classList.remove('bump');
    void line.node.offsetWidth;
    line.node.classList.add('bump');
  };
  const add = (line: Shown): Shown => {
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
    const { key, name, tile } = describe(w, e);
    const gold = e.item === 'gold';
    let line = shown.find((entry) => entry.key === key);
    if (line) {
      line.count += e.count;
      bump(line);
    } else {
      const node = document.createElement('div');
      node.className = 'pickup-line' + (gold ? ' gold' : '');
      node.append(icon(atlas, tile), document.createElement('span'));
      line = add({ key, node, count: e.count, timer: 0 });
    }
    line.node.lastElementChild!.textContent = label(name, line.count, gold);
    restart(line, PICKUP_SHOW_MS);
  };
  const showSkill = (e: Skill): void => {
    const key = 'skill:' + e.id;
    const skill = skillData(e.id);
    const perks = unlockedPerks(e.id, e.from, e.level);
    let line = shown.find((entry) => entry.key === key);
    if (line) {
      bump(line);
    } else {
      const node = document.createElement('div');
      node.className = 'pickup-line skill';
      const glyph = document.createElement('span');
      glyph.className = 'pickup-glyph';
      glyph.textContent = SKILL_ICONS[e.id] ?? '✦';
      const text = document.createElement('span');
      text.className = 'pickup-text';
      text.append(document.createElement('b'));
      node.append(glyph, text);
      line = add({ key, node, count: 0, timer: 0, perks: new Set() });
    }
    line.node.querySelector('b')!.textContent = `${skill.name} 숙련도 ${e.level}`;
    const text = line.node.querySelector('.pickup-text')!;
    for (const perk of perks) {
      if (line.perks!.has(perk)) continue;
      line.perks!.add(perk);
      const note = document.createElement('small');
      note.className = 'pickup-perk';
      note.textContent = `새 능력: ${perk}`;
      text.append(note);
    }
    restart(line, SKILL_SHOW_MS + (line.perks!.size > 0 ? 1000 : 0));
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
  };
}
