/** A band of monsters that sleeps, wakes and comes for the hero together. */
export interface PackKind {
  readonly id: string;
  /** Who is in it. The first entry grows by one for each floor past the pack's first. */
  readonly members: readonly { readonly kind: string; readonly min: number; readonly max: number }[];
  /** The first and last floor it is found on. */
  readonly floors: readonly [number, number];
  /** How often it is picked, against the others found on the same floor. */
  readonly weight: number;
}

export const PACKS: readonly PackKind[] = [
  { id: 'rats', members: [{ kind: 'rat', min: 4, max: 6 }], floors: [1, 2], weight: 3 },
  { id: 'goblins', members: [{ kind: 'goblin', min: 2, max: 3 }], floors: [1, 2], weight: 3 },
  { id: 'bats', members: [{ kind: 'bat', min: 2, max: 3 }], floors: [1, 3], weight: 2 },
  { id: 'jackals', members: [{ kind: 'jackal', min: 3, max: 4 }], floors: [1, 3], weight: 2 },
  { id: 'kobolds', members: [{ kind: 'kobold', min: 1, max: 2 }, { kind: 'goblin', min: 1, max: 1 }], floors: [1, 3], weight: 2 },
  { id: 'adders', members: [{ kind: 'adder', min: 2, max: 3 }], floors: [2, 3], weight: 2 },
  { id: 'gnolls', members: [{ kind: 'gnoll', min: 3, max: 4 }], floors: [2, 3], weight: 3 },
  { id: 'raiders', members: [{ kind: 'goblin', min: 3, max: 4 }, { kind: 'kobold', min: 2, max: 2 }], floors: [2, 3], weight: 2 },
  { id: 'ogre', members: [{ kind: 'ogre', min: 1, max: 1 }, { kind: 'goblin', min: 2, max: 2 }], floors: [3, 3], weight: 3 },
];

/** How the dungeon is filled and how it presses on a hero who lingers. Times are in seconds. */
export const DUNGEON = {
  floors: 3,
  /** Each floor past the first, monsters have this much more health. */
  tougher: 0.2,
  /** A swing of the axe is heard this many steps away by foot; walls stop it. */
  loud: 8,
  /** Standing on a way down this long takes it. */
  descend: 0.7,
  /** A floor is quiet this long; then bands come up the stairs, sooner and sooner. */
  calm: 30,
  bandEvery: 16,
  /** Each second on the floor takes this much off the wait, down to `bandLeast`. */
  bandSooner: 1 / 15,
  bandLeast: 7,
  /** No band comes while this many monsters are on the floor. */
  most: 110,
} as const;
