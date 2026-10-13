import { itemDefinition } from '../data/itemCatalog';
import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import { itemDisplayName, itemTile } from '../sim/identification';
import type { SimEvent, World } from '../sim/world';
import type { Atlas } from '../view/atlas';

/** How long one pickup line stays in the middle of the screen, and how many are shown at once. */
const SHOW_MS = 1600;
const MAX_LINES = 3;

type Pickup = Extract<SimEvent, { type: 'pickup' }>;

interface Shown {
  readonly key: string;
  readonly node: HTMLElement;
  count: number;
  timer: number;
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
 * What the hero just picked up, shown for a moment over the middle of the game view: one line per
 * kind of item, the count growing when more of the same comes in while it is still up.
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

  return {
    take(w) {
      for (const e of w.events) {
        if (e.type !== 'pickup' || e.count <= 0) continue;
        const { key, name, tile } = describe(w, e);
        const gold = e.item === 'gold';
        let line = shown.find((s) => s.key === key);
        if (line) {
          line.count += e.count;
          window.clearTimeout(line.timer);
          line.node.classList.remove('bump');
          void line.node.offsetWidth;
          line.node.classList.add('bump');
        } else {
          const node = document.createElement('div');
          node.className = 'pickup-line' + (gold ? ' gold' : '');
          node.append(icon(atlas, tile), document.createElement('span'));
          box.append(node);
          line = { key, node, count: e.count, timer: 0 };
          shown.push(line);
          while (shown.length > MAX_LINES) drop(shown[0]!);
        }
        line.node.lastElementChild!.textContent = label(name, line.count, gold);
        const current = line;
        line.timer = window.setTimeout(() => drop(current), SHOW_MS);
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
