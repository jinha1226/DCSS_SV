import { MONSTERS } from '../data/monsters';
import type { TileName } from '../data/tiles';
import { Cell, carve, makeGrid, setCell, type Grid } from './grid';

/** Something standing or lying on the floor. `x`, `y` is its middle, in cells. */
export interface Thing {
  readonly x: number;
  readonly y: number;
  readonly tile: TileName;
  readonly label?: string;
}

export interface Showroom {
  readonly grid: Grid;
  readonly hero: Thing;
  readonly things: readonly Thing[];
}

const mid = (cell: number): number => cell + 0.5;

/**
 * The room of stage 0: nothing moves. It puts every tile brought in so far on one screen, the
 * hero in the middle, with a wide corridor and a narrow one leading off, so the size of a tile
 * can be judged on a phone.
 */
export function makeShowroom(): Showroom {
  const grid = makeGrid(25, 47);
  carve(grid, 4, 13, 17, 21); // the room
  carve(grid, 11, 5, 3, 8); // a three-wide corridor north
  carve(grid, 7, 1, 11, 4); // a small room at its end
  carve(grid, 21, 22, 4, 2); // a two-wide corridor east
  carve(grid, 0, 22, 4, 2); // and west
  carve(grid, 11, 34, 3, 9); // a three-wide corridor south
  for (const [x, y] of [[6, 15], [17, 15], [6, 30], [17, 30]] as const) {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) setCell(grid, x + i, y + j, Cell.Wall);
  }
  setCell(grid, 12, 17, Cell.StairsDown);
  setCell(grid, 12, 31, Cell.StairsUp);

  const things: Thing[] = [];
  const columns = [7, 10, 14, 17];
  MONSTERS.forEach((m, i) => {
    things.push({ x: mid(columns[i % 4] ?? 7), y: mid(i < 4 ? 20 : 26), tile: m.tile, label: m.name });
  });
  const axes: readonly TileName[] = [
    'item/hand_axe1',
    'item/war_axe1',
    'item/broad_axe1',
    'item/battle_axe1',
    'item/executioner_axe1',
  ];
  axes.forEach((tile, i) => things.push({ x: mid(8 + i * 2), y: mid(28), tile }));

  return { grid, hero: { x: mid(12), y: mid(23), tile: 'hero/minotaur', label: '미노타우로스' }, things };
}
