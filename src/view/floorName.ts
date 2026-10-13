import type { World } from '../sim/types';

const BRANCH_NAMES: Readonly<Record<string, string>> = {
  Dungeon: '던전',
  Lair: '짐승굴',
  Orc: '오크 광산',
  Temple: '사원',
  Snake: '뱀 소굴',
  Spider: '거미 둥지',
  Swamp: '늪',
  Shoals: '해안',
  Vaults: '금고',
  Zot: '조트의 영역',
};

/** The floor the hero stands on, as the banner on arrival names it: "짐승굴 2층". */
export function floorName(w: World): string {
  const node = w.dungeonGraph.nodes.get(w.depth);
  return node ? `${BRANCH_NAMES[node.branch] ?? node.branch} ${node.floor}층` : '새 층';
}
