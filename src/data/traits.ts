export const TRAIT_IDS = new Set(['horns', 'headbutt_back']);

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

export type TraitData = HornTrait | HeadbuttBackTrait;
