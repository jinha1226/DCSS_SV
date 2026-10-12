import { heroFor } from '../data/hero';
import { plainWeapon } from '../data/items';
import { DUNGEON } from '../data/packs';
import { moveCircle } from './collide';
import { KNOCK_FADE, heroStrikes } from './combat';
import { shove } from './crowd';
import { collectGround, populateFloorItems } from './equipment';
import type { Floor } from './floor';
import { makeFlow, updateFlow } from './flow';
import { computeFov } from './fov';
import { makeFloor } from './gen';
import { Cell, cellAt } from './grid';
import { tickHop, tryHop } from './hop';
import { thinkMonster } from './monster';
import { fillFloor, lingering } from './packs';
import { makeRng, type Rng } from './rng';
import { initializeItemKnowledge } from './identification';
import { heroSpeed, openStartingSkills } from './skills';
import { castAt, stepSpells } from './spells';
import type { FloorState, Input, Stairs, World } from './types';
export type { GroundItem, Hero, Input, Monster, PickupStats, Shot, SimEvent, SkillChoice, Stairs, World } from './types';
export const STEP = 1 / 60;
export interface WorldOptions {
  readonly seed?: number;
  readonly speed?: number;
  readonly depth?: number;
  readonly floor?: Floor;
  readonly species?: string;
  readonly job?: string;
  readonly monsters?: boolean;
  readonly items?: boolean;
  readonly definition?: ReturnType<typeof heroFor>;
}
const SETTLE = 2;
export const floorSeed = (seed: number, depth: number): number => (Math.imul(seed, 2654435761) + depth * 97) >>> 0;
function stairsOf(floor: Floor): Stairs[] {
  const out: Stairs[] = [];
  for (let y = 0; y < floor.grid.h; y++)
    for (let x = 0; x < floor.grid.w; x++) {
      const c = cellAt(floor.grid, x, y);
      if (c === Cell.StairsDown || c === Cell.StairsUp) out.push({ x, y, down: c === Cell.StairsDown });
    }
  return out;
}
function look(w: World): void {
  const x = Math.floor(w.hero.x),
    y = Math.floor(w.hero.y);
  computeFov(w.grid, x, y, w.heroDef.sight, w.visible);
  for (let i = 0; i < w.visible.length; i++) if (w.visible[i]) w.seen[i] = 1;
  updateFlow(w.flow, w.grid, x, y);
}
function enter(w: World, floor: Floor, monsters: boolean): void {
  const size = floor.grid.w * floor.grid.h;
  w.grid = floor.grid;
  w.rooms = floor.rooms;
  w.stairs = stairsOf(floor);
  w.flow = makeFlow(floor.grid);
  w.visible = new Uint8Array(size);
  w.seen = new Uint8Array(size);
  w.monsters.length = 0;
  w.shots.length = 0;
  w.spellShots.length = 0;
  w.spellClouds.length = 0;
  w.spellVisuals.length = 0;
  w.groundItems.length = 0;
  w.pendingPickup = null;
  w.floorTime = 0;
  w.descending = 0;
  w.nextBand = Infinity;
  w.hero.lastStandUsed = false;
  w.hero.x = w.hero.px = floor.start.x;
  w.hero.y = w.hero.py = floor.start.y;
  look(w);
  if (monsters) fillFloor(w);
  if (w.itemsEnabled) populateFloorItems(w);
}
export function makeWorld(options: WorldOptions = {}): World {
  const seed = options.seed ?? 1,
    depth = Math.min(DUNGEON.floors, Math.max(1, options.depth ?? 1)),
    floor = options.floor ?? makeFloor(floorSeed(seed, depth)),
    heroDef = options.definition ?? heroFor(options.species, options.job);
  const weapon = plainWeapon(heroDef.startingWeapon, 'start');
  const floorRng = new Map<number, Rng>([[depth, makeRng(seed ^ 0x5bd1e995)]]);
  const world: World = {
    grid: floor.grid,
    rooms: floor.rooms,
    stairs: [],
    flow: makeFlow(floor.grid),
    visible: new Uint8Array(0),
    seen: new Uint8Array(0),
    hero: {
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      facing: -1,
      moving: false,
      hp: heroDef.hp,
      maxHp: heroDef.hp,
      mana: heroDef.mana,
      maxMana: heroDef.mana,
      swing: 0,
      butt: 0,
      hurt: 0,
      poison: 0,
      throwing: 0,
      spellCooldown: 0,
      level: 1,
      xp: 0,
      skills: {},
      invulnerable: 0,
      lastStandUsed: false,
      might: 0,
      haste: 0,
      axeSwings: 0,
      hopCooldown: 0,
      hopTime: 0,
      hopDuration: 0,
      hopFromX: 0,
      hopFromY: 0,
      hopToX: 0,
      hopToY: 0,
    },
    heroDef,
    monsters: [],
    shots: [],
    spellShots: [],
    spellClouds: [],
    spellVisuals: [],
    // The facade remains stable while its source switches with the active floor.
    rng: () => {
      // Tests and developer tools may change depth directly without using stairs.
      let source = floorRng.get(world.depth);
      if (!source) {
        source = makeRng(floorSeed(seed, world.depth) ^ 0x5bd1e995);
        floorRng.set(world.depth, source);
      }
      return source();
    },
    events: [],
    seed,
    weapon,
    inventory: [],
    gear: {},
    gearEnchantment: {},
    cursedGear: new Set<string>(),
    identifiedItems: new Set<string>(),
    itemAppearances: {},
    ammo: heroDef.startingAmmo,
    groundItems: [],
    pendingPickup: null,
    artefactPlaced: false,
    nextItem: 1,
    itemsEnabled: options.items !== false,
    pickupStats: { offered: 0, swapped: 0, throws: 0, recovered: 0 },
    openSkills: new Set<string>(),
    guaranteedSkills: [],
    depth,
    floorStates: new Map<number, FloorState>(),
    floorRng,
    stairConnections: new Map(),
    monstersEnabled: options.monsters !== false,
    time: 0,
    floorTime: 0,
    speed: options.speed ?? heroDef.speed,
    kills: 0,
    nextPack: 1,
    nextBand: Infinity,
    descending: 0,
    stairsArmed: true,
    pendingChoices: 0,
    choosing: null,
    over: false,
    won: false,
  };
  initializeItemKnowledge(world);
  openStartingSkills(world);
  enter(world, floor, options.monsters !== false);
  return world;
}
/** Snapshot mutable floor state before traversing stairs. The hero, inventory and run RNG remain global. */
function rememberFloor(w: World, returnX: number, returnY: number): void {
  w.floorStates.set(w.depth, {
    grid: w.grid,
    rooms: w.rooms,
    seen: w.seen,
    monsters: [...w.monsters],
    groundItems: [...w.groundItems],
    floorTime: w.floorTime,
    nextBand: w.nextBand,
    lastStandUsed: w.hero.lastStandUsed,
    returnX,
    returnY,
  });
}

function restoreFloor(w: World, state: FloorState, x: number, y: number): void {
  w.grid = state.grid;
  w.rooms = state.rooms;
  w.stairs = stairsOf({ grid: state.grid, rooms: state.rooms, start: { x, y } });
  w.flow = makeFlow(state.grid);
  w.visible = new Uint8Array(state.grid.w * state.grid.h);
  w.seen = state.seen;
  w.monsters.splice(0, w.monsters.length, ...state.monsters);
  w.groundItems.splice(0, w.groundItems.length, ...state.groundItems);
  w.shots.length = 0;
  w.spellShots.length = 0;
  w.spellClouds.length = 0;
  w.spellVisuals.length = 0;
  w.pendingPickup = null;
  w.floorTime = state.floorTime;
  w.nextBand = state.nextBand;
  w.hero.lastStandUsed = state.lastStandUsed;
  w.descending = 0;
  w.hero.x = w.hero.px = x;
  w.hero.y = w.hero.py = y;
  look(w);
}

function standAt(w: World, x: number, y: number): void {
  w.hero.x = w.hero.px = x;
  w.hero.y = w.hero.py = y;
  look(w);
}

function traverse(w: World, down: boolean): void {
  const previous = w.depth;
  const target = previous + (down ? 1 : -1);
  if (target < 1 || target > DUNGEON.floors) return;
  const sourceX = Math.floor(w.hero.x) + 0.5;
  const sourceY = Math.floor(w.hero.y) + 0.5;
  rememberFloor(w, sourceX, sourceY);
  w.depth = target;

  // Existing floors resume their own RNG stream; unvisited ones start from a fixed seed.
  if (!w.floorRng.has(target)) w.floorRng.set(target, makeRng(floorSeed(w.seed, target) ^ 0x5bd1e995));
  const existing = w.floorStates.get(target);
  if (existing) {
    restoreFloor(w, existing, existing.returnX, existing.returnY);
  } else {
    enter(w, makeFloor(floorSeed(w.seed, target)), w.monstersEnabled);
    rememberFloor(w, w.hero.x, w.hero.y);
  }

  if (down) {
    // All three down stairs currently lead to the same child floor. Its single up stair
    // returns to the exact parent stair most recently used to enter that floor.
    const up = w.stairs.find((stair) => !stair.down);
    if (up) {
      const childX = up.x + 0.5;
      const childY = up.y + 0.5;
      w.stairConnections.set(target, { parentDepth: previous, parentX: sourceX, parentY: sourceY, childX, childY });
      standAt(w, childX, childY);
    }
  } else {
    const link = w.stairConnections.get(previous);
    const fallback = w.stairs.find((stair) => stair.down);
    const parentX = link?.parentDepth === target ? link.parentX : (fallback?.x ?? Math.floor(w.hero.x)) + 0.5;
    const parentY = link?.parentDepth === target ? link.parentY : (fallback?.y ?? Math.floor(w.hero.y)) + 0.5;
    standAt(w, parentX, parentY);
    // Starting a run directly on a deeper floor has no incoming link. Establish one.
    if (!link)
      w.stairConnections.set(previous, {
        parentDepth: target,
        parentX,
        parentY,
        childX: sourceX,
        childY: sourceY,
      });
  }

  // Time alone cannot reactivate arrival stairs; the player must move off them first.
  w.stairsArmed = false;
  w.descending = 0;
  w.events.push({ type: 'floor', depth: w.depth });
}

function walkHero(w: World, input: Input, dt: number): void {
  const h = w.hero;
  if (h.hopTime > 0) {
    h.moving = false;
    return;
  }
  let { mx, my } = input;
  const length = Math.hypot(mx, my);
  if (length > 1) {
    mx /= length;
    my /= length;
  }
  h.moving = length > 0;
  if (!h.moving) return;
  const speed = heroSpeed(w),
    to = moveCircle(w.grid, h, w.heroDef.radius, mx * speed * dt, my * speed * dt);
  h.x = to.x;
  h.y = to.y;
  if (mx < -0.15) h.facing = -1;
  else if (mx > 0.15) h.facing = 1;
}
function shoveHero(w: World, dx: number, dy: number): void {
  if ((dx === 0 && dy === 0) || w.hero.hopTime > 0) return;
  const to = moveCircle(w.grid, w.hero, w.heroDef.radius, dx, dy);
  w.hero.x = to.x;
  w.hero.y = to.y;
}
function walkMonsters(w: World, dt: number): void {
  const wants = w.monsters.map((m) => thinkMonster(w, m, dt));
  if (w.over) return;
  const push = shove(w),
    fade = Math.exp(-KNOCK_FADE * dt);
  w.monsters.forEach((m, i) => {
    const want = wants[i]!,
      sx = push.x[i]!,
      sy = push.y[i]!,
      squeeze = Math.hypot(sx, sy);
    m.px = m.x;
    m.py = m.y;
    if (squeeze > 1e-5) {
      const into = (want.vx * sx + want.vy * sy) / squeeze;
      if (into < 0) {
        want.vx -= (into * sx) / squeeze;
        want.vy -= (into * sy) / squeeze;
      }
    }
    const dx = (want.vx + m.kx) * dt + sx,
      dy = (want.vy + m.ky) * dt + sy;
    m.kx *= fade;
    m.ky *= fade;
    if (dx === 0 && dy === 0) return;
    const to = moveCircle(w.grid, m, m.stats.radius, dx, dy);
    m.x = to.x;
    m.y = to.y;
  });
  shoveHero(w, push.heroX, push.heroY);
  for (let pass = 0; pass < SETTLE; pass++) {
    const more = shove(w);
    w.monsters.forEach((m, i) => {
      const sx = more.x[i]!,
        sy = more.y[i]!;
      if (sx === 0 && sy === 0) return;
      const to = moveCircle(w.grid, m, m.stats.radius, sx, sy);
      m.x = to.x;
      m.y = to.y;
    });
    shoveHero(w, more.heroX, more.heroY);
  }
}
function stairsUnderfoot(w: World, dt: number): void {
  const cell = cellAt(w.grid, Math.floor(w.hero.x), Math.floor(w.hero.y));
  const down = cell === Cell.StairsDown;
  const up = cell === Cell.StairsUp;
  const usable = down || (up && w.depth > 1);
  if (!usable) {
    w.stairsArmed = true;
    w.descending = 0;
    return;
  }
  if (!w.stairsArmed) {
    w.descending = 0;
    return;
  }
  w.descending += dt;
  if (w.descending < DUNGEON.descend) return;
  if (down && w.depth >= DUNGEON.floors) {
    w.over = true;
    w.won = true;
    return;
  }
  traverse(w, down);
}
export function stepWorld(w: World, input: Input, dt: number = STEP): void {
  w.events.length = 0;
  if (w.over || w.choosing || w.pendingPickup) return;
  const h = w.hero,
    cx = Math.floor(h.x),
    cy = Math.floor(h.y);
  h.px = h.x;
  h.py = h.y;
  w.time += dt;
  w.floorTime += dt;
  tickHop(w, dt);
  h.might = Math.max(0, h.might - dt);
  h.haste = Math.max(0, h.haste - dt);
  if (input.hop) tryHop(w, input);
  walkHero(w, input, dt);
  if (Math.floor(h.x) !== cx || Math.floor(h.y) !== cy) look(w);
  if (w.itemsEnabled) {
    collectGround(w);
    if (w.pendingPickup) return;
  }
  if (input.spell) castAt(w, input.spell.id, input.spell.x, input.spell.y);
  if (w.choosing) return;
  walkMonsters(w, dt);
  if (w.over) return;
  heroStrikes(w, dt, input.throw === true);
  stepSpells(w, dt);
  if (w.over || w.choosing) return;
  if (w.itemsEnabled) collectGround(w);
  lingering(w, dt);
  stairsUnderfoot(w, dt);
}
