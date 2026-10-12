import { ITEM_DEFINITIONS } from '../data/itemCatalog';
import type { World } from './types';

const COLOURS = ['붉은', '푸른', '초록', '보라', '황금', '흐린', '검은', '은빛', '분홍', '주황', '투명', '갈색'];
/** The flask each potion colour is drawn with (DCSS potion tiles), so the picture never gives the potion away. */
const FLASKS: Readonly<Record<string, string>> = {
  붉은: 'item/potion/ruby',
  푸른: 'item/potion/brilliant_blue',
  초록: 'item/potion/emerald',
  보라: 'item/potion/purple_red',
  황금: 'item/potion/golden',
  흐린: 'item/potion/cloudy',
  검은: 'item/potion/black',
  은빛: 'item/potion/silver',
  분홍: 'item/potion/pink',
  주황: 'item/potion/orange',
  투명: 'item/potion/white',
  갈색: 'item/potion/brown',
};
const SCROLL = 'item/scroll/scroll';
const MARKS = ['IX', 'KIR', 'SEN', 'VOR', 'QUM', 'ASH', 'TEK', 'YEL', 'DRA', 'MOR', 'ZAN', 'UL'];

/** Per-run shuffled appearances; all stacks with the same true ID look alike. */
export function initializeItemKnowledge(w: World): void {
  for (const kind of ['potion', 'scroll'] as const) {
    const ids = ITEM_DEFINITIONS.filter((item) => item.enabled && item.kind === kind).map((item) => item.id);
    const looks = ids.map((_, i) =>
      kind === 'potion' ? COLOURS[i % COLOURS.length]! + ' 물약' : '「' + MARKS[i % MARKS.length] + '」 두루마리',
    );
    for (let i = looks.length - 1; i > 0; i--) {
      const j = Math.floor(w.rng() * (i + 1));
      [looks[i], looks[j]] = [looks[j]!, looks[i]!];
    }
    ids.forEach((id, i) => {
      w.itemAppearances[id] = looks[i]!;
    });
  }
}

export function identifyItem(w: World, id: string): void {
  w.identifiedItems.add(id);
}

export function itemDisplayName(w: World, id: string): string {
  const item = ITEM_DEFINITIONS.find((row) => row.id === id);
  if (!item) return id;
  if (!w.identifiedItems.has(id) && (item.kind === 'potion' || item.kind === 'scroll')) {
    return w.itemAppearances[id] ?? (item.kind === 'potion' ? '미감정 물약' : '미감정 두루마리');
  }
  return item.name;
}

/**
 * The tile an item is shown with. As in DCSS, a potion keeps its flask colour and every scroll looks
 * alike whether or not it has been identified, so icons never reveal what names hide.
 */
export function itemTile(w: World, id: string): string | undefined {
  const item = ITEM_DEFINITIONS.find((row) => row.id === id);
  if (!item) return undefined;
  if (item.kind === 'scroll') return SCROLL;
  if (item.kind === 'potion') {
    const colour = (w.itemAppearances[id] ?? '').split(' ')[0] ?? '';
    return FLASKS[colour] ?? 'item/potion/cloudy';
  }
  return item.tile;
}
