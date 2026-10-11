import { ITEM_DEFINITIONS } from '../data/itemCatalog';
import type { World } from './types';

const COLOURS = ['붉은', '푸른', '초록', '보라', '황금', '흐린', '검은', '은빛', '분홍', '주황', '투명', '갈색'];
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
