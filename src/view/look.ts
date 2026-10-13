import { tileSet, type TileName } from '../data/tiles';
import type { Branch } from '../sim/dungeonGraph';

export const LOOKS = ['dcss', 'bright'] as const;
export type LookName = (typeof LOOKS)[number];

/** The tiles a floor is drawn with. */
export interface Look {
  readonly floor: readonly TileName[];
  readonly wall: readonly TileName[];
  /** What lies beyond the floor. */
  readonly back: string;
}

export const LOOK: Record<LookName, Look> = {
  // The first floors of the original: dark earth and brown brick.
  dcss: { floor: tileSet('floor/grey_dirt'), wall: tileSet('wall/brick_brown'), back: '#000000' },
  // The same floor in pale stone, to compare how tiring each is to look at.
  bright: { floor: tileSet('floor/limestone'), wall: tileSet('wall/brick_gray'), back: '#16130f' },
};

const branchLooks = (floor: string, wall: string, back: string): Look => ({
  floor: tileSet('dcss/dngn/floor/' + floor),
  wall: tileSet(wall.startsWith('derived/') ? 'dcss/' + wall : 'dcss/dngn/wall/' + wall),
  back,
});

/**
 * Each branch in the floor and wall DCSS gives it (tileview.cc, tile_default_flv). Two walls are
 * stand-ins because the originals are not free to reuse: Spider's own wall (by an artist who never
 * signed off) becomes its stone wall, and Zot's yellow wall is made from the blue one the way DCSS does.
 * The Dungeon keeps the look picked in the settings.
 */
export const BRANCH_LOOK: Readonly<Record<Exclude<Branch, 'Dungeon'>, Look>> = {
  Lair: branchLooks('lair', 'lair', '#0b0a06'),
  Orc: branchLooks('orc', 'orc', '#0a0706'),
  Temple: branchLooks('floor_vines', 'wall_vines', '#070a06'),
  Snake: branchLooks('mosaic', 'snake', '#0a0a05'),
  Spider: branchLooks('spider', 'wall_stone_spider', '#060608'),
  Swamp: branchLooks('swamp', 'lab-rock', '#070a07'),
  Shoals: branchLooks('sand', 'shoals_wall', '#05090c'),
  Vaults: branchLooks('rect_gray', 'vault', '#08080a'),
  Zot: branchLooks('tomb', 'derived/wall/zot_yellow', '#0a0805'),
};

/** The look of the floor the hero stands on: its branch's, or `dungeon` in the Dungeon itself. */
export function lookFor(branch: Branch | undefined, dungeon: Look): Look {
  return !branch || branch === 'Dungeon' ? dungeon : BRANCH_LOOK[branch];
}
