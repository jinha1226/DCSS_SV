export const TRAIT_IDS = new Set(['horns', 'headbutt_back', 'hop', 'stone_body']);

export interface HornTrait {
  readonly id: 'horns';
  readonly damage: number;
  readonly reach: number;
  readonly every: number;
  readonly knock: number;
  readonly stun: number;
  readonly damageEveryLevel: number;
  readonly damageGain: number;
  readonly speedEveryLevel: number;
  readonly speedGain: number;
  readonly minEvery: number;
}

export interface HeadbuttBackTrait {
  readonly id: 'headbutt_back';
}

export interface HopTrait {
  readonly id: 'hop';
  readonly distance: number;
  readonly distanceLevel: number;
  readonly distanceHigh: number;
  readonly cooldown: number;
  readonly duration: number;
}

/**
 * A gargoyle's stone body: armour that grows with level, as DCSS's stone_body_armour_bonus
 * (2 + 0.4 per level, and another 0.4 per level past 7), times `scale` to fit this game's armour.
 */
export interface StoneBodyTrait {
  readonly id: 'stone_body';
  readonly base: number;
  readonly perLevel: number;
  readonly lateFrom: number;
  readonly latePerLevel: number;
  readonly scale: number;
}

export type TraitData = HornTrait | HeadbuttBackTrait | HopTrait | StoneBodyTrait;
