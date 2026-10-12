/** Seeded dungeon topology. IDs are stable storage keys, never difficulty ratings. */
export type Branch = 'Dungeon' | 'Lair' | 'Orc' | 'Temple' | 'Snake' | 'Spider' | 'Swamp' | 'Shoals' | 'Vaults' | 'Zot';
export interface DungeonNode {
  readonly id: number;
  readonly branch: Branch;
  readonly floor: number;
  readonly difficulty: number;
  readonly parent?: number;
}
export interface DungeonGraph {
  readonly nodes: ReadonlyMap<number, DungeonNode>;
  readonly runeBranches: readonly [Branch, Branch];
}
export const DUNGEON_START = 1;
export function makeDungeonGraph(seed: number): DungeonGraph {
  const nodes = new Map<number, DungeonNode>();
  for (let floor = 1; floor <= 9; floor++)
    nodes.set(floor, { id: floor, branch: 'Dungeon', floor, difficulty: floor, ...(floor > 1 ? { parent: floor - 1 } : {}) });
  nodes.set(901, { id: 901, branch: 'Temple', floor: 1, difficulty: 3, parent: 3 });
  const first: Branch = (seed & 1) === 0 ? 'Snake' : 'Spider';
  const second: Branch = (seed & 2) === 0 ? 'Swamp' : 'Shoals';
  const branches: readonly [Branch, number, number, number, number][] = [
    ['Lair', 100, 3, 4, 5],
    ['Orc', 200, 3, 6, 7],
    [first, 300, 3, 101, 9],
    [second, 400, 3, 102, 10],
    ['Vaults', 700, 3, 9, 12],
    ['Zot', 800, 3, 703, 17],
  ];
  for (const [branch, base, length, parent, difficulty] of branches)
    for (let floor = 1; floor <= length; floor++) {
      const id = base + floor;
      nodes.set(id, { id, branch, floor, difficulty: difficulty + floor - 1, parent: floor === 1 ? parent : id - 1 });
    }
  return { nodes, runeBranches: [first, second] };
}
/** Slot 0 continues the current branch; remaining stairs enter branches in stable order. */
export function downDestinations(graph: DungeonGraph, id: number): readonly number[] {
  const current = graph.nodes.get(id);
  if (!current) return [];
  const children = [...graph.nodes.values()].filter((node) => node.parent === id);
  const same = children.find((node) => node.branch === current.branch);
  return [...(same ? [same.id] : []), ...children.filter((node) => node !== same).map((node) => node.id)];
}
export function nodeLabel(node: DungeonNode): string {
  return node.branch + ' ' + node.floor;
}
