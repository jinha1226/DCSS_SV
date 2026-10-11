/** The Minotaur Berserker. Lengths are in cells, times in seconds. */
export const HERO = {
  /** Half the hero's width. */
  radius: 0.35,
  /** Cells walked in a second. */
  speed: 6.5,
  /** How far the hero sees: enough to cover a tall screen. Walls cut it short. */
  sight: 20,
  hp: 60,
  /** Health that comes back by itself in a second. */
  regen: 0.5,
  /** How much of a shove between hero and monster moves the hero; the rest moves the monster. */
  give: 0.3,
  /** The axe swings by itself at whatever is in reach, and cuts everything in reach at once. */
  axe: {
    damage: 7,
    /** From the hero's middle to the monster's near edge. */
    reach: 1.2,
    every: 0.7,
    /** How fast a struck monster is thrown back, in cells a second; it dies away quickly. */
    knock: 1.2,
  },
  /** A boomerang, thrown when the player asks: the one blow that is not automatic. */
  thrown: {
    damage: 8,
    /** How far off a target may be, and how fast the boomerang flies. */
    range: 8,
    speed: 15,
    every: 1.4,
    knock: 3,
  },
  /** Where the standing tile is cut to make it step: the legs start at row 25, and part at column 17. */
  walk: { legs: 25, mid: 17 },
  /** The horns: now and then the nearest monster that has closed in is butted away. */
  horns: {
    damage: 5,
    reach: 0.75,
    every: 2.4,
    knock: 13,
    /** How long the butted monster stands dazed. */
    stun: 0.6,
  },
} as const;
