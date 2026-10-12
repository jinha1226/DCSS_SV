import { describe, expect, it } from 'vitest';
import { downDestinations, makeDungeonGraph } from '../../src/sim/dungeonGraph';
import { DUNGEON } from '../../src/data/packs';

describe('stage 3: seeded dungeon topology', () => {
  it('keeps Dungeon 1..9 and generates 24 mandatory nodes plus optional Orc and Temple', () => {
    expect(DUNGEON.floors).toBe(9);
    for (const seed of [1, 2, 3, 4, 200, 901]) {
      const graph = makeDungeonGraph(seed);
      expect(graph.nodes.size).toBe(28);
      for (let floor = 1; floor <= 9; floor++) {
        expect(graph.nodes.get(floor)?.branch).toBe('Dungeon');
        expect(graph.nodes.get(floor)?.floor).toBe(floor);
      }
      expect(graph.nodes.get(101)?.parent).toBe(4);
      expect(graph.nodes.get(201)?.parent).toBe(6);
      expect(graph.nodes.get(901)?.parent).toBe(3);
      expect(graph.nodes.get(301)?.parent).toBe(101);
      expect(graph.nodes.get(401)?.parent).toBe(102);
      expect(graph.nodes.get(701)?.parent).toBe(9);
      expect(graph.nodes.get(801)?.parent).toBe(703);
    }
  });

  it('is deterministic and selects exactly one branch from each rune pair', () => {
    for (let seed = 0; seed < 100; seed++) {
      const a = makeDungeonGraph(seed);
      const b = makeDungeonGraph(seed);
      expect([...a.nodes.values()]).toEqual([...b.nodes.values()]);
      expect(['Snake', 'Spider']).toContain(a.runeBranches[0]);
      expect(['Swamp', 'Shoals']).toContain(a.runeBranches[1]);
      expect(a.nodes.get(301)?.branch).toBe(a.runeBranches[0]);
      expect(a.nodes.get(401)?.branch).toBe(a.runeBranches[1]);
    }
  });

  it('has no unreachable mandatory or optional nodes and at most three exits', () => {
    for (let seed = 0; seed < 20; seed++) {
      const graph = makeDungeonGraph(seed);
      const visited = new Set<number>();
      const pending = [1];
      while (pending.length) {
        const id = pending.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const exits = downDestinations(graph, id);
        expect(exits.length).toBeLessThanOrEqual(3);
        pending.push(...exits);
      }
      expect(visited.size).toBe(graph.nodes.size);
      expect(downDestinations(graph, 9)).toEqual([701]);
      expect(downDestinations(graph, 703)).toEqual([801]);
      expect(downDestinations(graph, 103)).toEqual([]);
    }
  });
});
