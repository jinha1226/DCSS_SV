import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../../src/data/packs';
import { downDestinations } from '../../src/sim/dungeonGraph';
import { Cell } from '../../src/sim/grid';
import { spawnMonster } from '../../src/sim/monster';
import { makeWorld, STEP, stepWorld, type World } from '../../src/sim/world';

const IDLE = { mx: 0, my: 0 };
function take(w: World, down: boolean, index = 0): void {
  const free = w.grid.cells.indexOf(Cell.Floor);
  w.hero.x = (free % w.grid.w) + 0.5;
  w.hero.y = Math.floor(free / w.grid.w) + 0.5;
  stepWorld(w, IDLE);
  const stair = w.stairs.filter((s) => s.down === down)[index]!;
  w.hero.x = stair.x + 0.5;
  w.hero.y = stair.y + 0.5;
  for (let i = 0; i < Math.ceil((DUNGEON.descend + STEP) / STEP); i++) stepWorld(w, IDLE);
}
describe('stage 3: branch traversal integration', () => {
  it('enters Lair through Dungeon 4 and returns to the same entrance', () => {
    const w = makeWorld({ seed: 2, depth: 4, monsters: false, items: false });
    const exits = downDestinations(w.dungeonGraph, 4);
    expect(exits).toEqual([5, 101]);
    const stair = w.stairs.filter((s) => s.down)[1]!;
    take(w, true, 1);
    expect(w.depth).toBe(101);
    expect(w.dungeonGraph.nodes.get(w.depth)?.branch).toBe('Lair');
    take(w, false);
    expect(w.depth).toBe(4);
    expect(w.hero.x).toBe(stair.x + 0.5);
    expect(w.hero.y).toBe(stair.y + 0.5);
  });
  it('keeps branch identity separate from monster HP scaling', () => {
    const w = makeWorld({ seed: 2, depth: 101, monsters: false, items: false });
    const monster = spawnMonster(w, 'rat', w.hero.x + 1, w.hero.y, false);
    expect(monster.maxHp).toBeLessThan(monster.stats.hp * 10);
  });
  it('blocks Zot until both seeded rune branches are collected', () => {
    const w = makeWorld({ seed: 2, depth: 703, monsters: false, items: false });
    take(w, true);
    expect(w.depth).toBe(703);
    w.runes.add(w.dungeonGraph.runeBranches[0]);
    take(w, true);
    expect(w.depth).toBe(703);
    w.runes.add(w.dungeonGraph.runeBranches[1]);
    take(w, true);
    expect(w.depth).toBe(801);
    expect(w.won).toBe(false);
  });
  it('does not award victory merely for reaching the end of a branch', () => {
    const w = makeWorld({ seed: 2, depth: 803, monsters: false, items: false });
    expect(downDestinations(w.dungeonGraph, w.depth)).toEqual([]);
    take(w, true);
    expect(w.over).toBe(false);
    expect(w.won).toBe(false);
  });
});
