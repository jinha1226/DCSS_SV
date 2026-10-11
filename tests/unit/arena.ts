import { carve, makeGrid } from '../../src/sim/grid';
import { STEP, makeWorld, stepWorld, type Input, type SimEvent, type World } from '../../src/sim/world';

export const STILL: Input = { mx: 0, my: 0 };

/** One open room, 18 by 18, the hero in the middle and nothing else in it. */
export function arena(depth = 1): World {
  const grid = makeGrid(20, 20);
  carve(grid, 1, 1, 18, 18);
  return makeWorld({ floor: { grid, start: { x: 10, y: 10 }, rooms: [{ x: 1, y: 1, w: 18, h: 18 }] }, monsters: false, items: false, depth });
}

/** A world whose hero holds its own blows, to watch what monsters do. */
export function quietArena(): World {
  const w = arena();
  w.hero.swing = w.hero.butt = 1e9;
  return w;
}

/** Steps the world for `seconds`, gathering what happened. */
export function run(w: World, seconds: number, input: Input = STILL): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / STEP); i++) {
    stepWorld(w, input);
    events.push(...w.events);
  }
  return events;
}

export const count = (events: readonly SimEvent[], type: SimEvent['type']): number => events.filter((e) => e.type === type).length;
