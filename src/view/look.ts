import { tileSet, type TileName } from '../data/tiles';

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
