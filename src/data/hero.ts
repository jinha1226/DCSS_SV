import jobsRaw from './json/jobs.json';
import speciesRaw from './json/species.json';
import { THROW_DATA, plainWeapon, type ResistName } from './items';
import { itemDefinition } from './itemCatalog';
import { SKILLS } from './skills';
import { hasTile, type TileName } from './tiles';
import { TRAIT_IDS, type TraitData } from './traits';

export type Aptitude = 'good' | 'normal' | 'bad';

export interface HeroDefinition {
  readonly species: string;
  readonly job: string;
  readonly name: string;
  readonly tile: TileName;
  readonly radius: number;
  readonly speed: number;
  readonly sight: number;
  readonly hp: number;
  readonly mana: number;
  readonly manaRegen: number;
  readonly regen: number;
  readonly give: number;
  readonly walk: { readonly legs: number; readonly mid: number };
  readonly axe: { readonly damage: number; readonly reach: number; readonly every: number; readonly knock: number };
  readonly thrown: {
    readonly damage: number;
    readonly range: number;
    readonly speed: number;
    readonly every: number;
    readonly knock: number;
  };
  readonly traits: readonly TraitData[];
  readonly resists: Readonly<Partial<Record<ResistName, number>>>;
  readonly aptitudes: Readonly<Record<string, Aptitude>>;
  readonly startingWeapon: string;
  readonly startingOffhand?: string;
  /** Body armour worn from the start, as in the DCSS job's kit. */
  readonly startingArmour?: string;
  /** Consumables carried from the start, already identified. */
  readonly startingItems: readonly { readonly id: string; readonly count: number }[];
  readonly startingAmmo: number;
  readonly startingSkills: Readonly<Record<string, number>>;
}

type SpeciesRow = (typeof speciesRaw)[number];
type JobRow = (typeof jobsRaw)[number];

function species(id: string): SpeciesRow {
  const row = speciesRaw.find((entry) => entry.id === id);
  if (!row) throw new Error('species.json: ' + id + ': 없는 종족');
  if (!hasTile(row.tile)) throw new Error('species.json: ' + id + '.tile: 없는 타일 ' + row.tile);
  for (const aptitude of Object.values(row.aptitudes)) {
    if (!['good', 'normal', 'bad'].includes(aptitude)) {
      throw new Error('species.json: ' + id + '.aptitudes: 잘못된 적성 ' + aptitude);
    }
  }
  for (const trait of row.traits) {
    if (!TRAIT_IDS.has(trait.id)) throw new Error('species.json: ' + id + '.traits: 없는 특성 ' + trait.id);
  }
  return row;
}

function job(id: string): JobRow {
  const row = jobsRaw.find((entry) => entry.id === id);
  if (!row) throw new Error('jobs.json: ' + id + ': 없는 직업');
  plainWeapon(row.startingWeapon);
  if ('startingOffhand' in row && typeof row.startingOffhand === 'string' && itemDefinition(row.startingOffhand).kind !== 'spellbook') {
    throw new Error('jobs.json: ' + row.id + '.startingOffhand: 마법서가 아님');
  }
  if ('startingArmour' in row && typeof row.startingArmour === 'string' && itemDefinition(row.startingArmour).kind !== 'armour') {
    throw new Error('jobs.json: ' + row.id + '.startingArmour: 갑옷이 아님');
  }
  for (const item of ('startingItems' in row ? row.startingItems : undefined) ?? []) itemDefinition(item.id);
  for (const skill of Object.keys(row.startingSkills)) {
    if (!SKILLS.some((entry) => entry.id === skill)) {
      throw new Error('jobs.json: ' + id + '.startingSkills: 없는 스킬 ' + skill);
    }
  }
  return row;
}

export function heroFor(speciesId = 'minotaur', jobId = 'berserker'): HeroDefinition {
  const s = species(speciesId);
  const j = job(jobId);
  const weapon = plainWeapon(j.startingWeapon);
  const startingSkills: Record<string, number> = {};
  for (const [id, level] of Object.entries(j.startingSkills)) {
    if (typeof level === 'number') startingSkills[id] = level;
  }
  return {
    species: s.id,
    job: j.id,
    name: s.name + ' ' + j.name,
    tile: s.tile as TileName,
    radius: s.radius,
    speed: s.speed,
    sight: s.sight,
    hp: s.hp,
    mana: s.mana,
    manaRegen: s.manaRegen,
    regen: s.regen,
    give: s.give,
    walk: s.walk,
    axe: { damage: weapon.damage, reach: weapon.range, every: weapon.every, knock: weapon.knock },
    thrown: THROW_DATA,
    traits: s.traits as readonly TraitData[],
    resists: 'resists' in s ? (s.resists as Readonly<Partial<Record<ResistName, number>>>) : {},
    aptitudes: s.aptitudes as Readonly<Record<string, Aptitude>>,
    startingWeapon: j.startingWeapon,
    ...('startingOffhand' in j ? { startingOffhand: j.startingOffhand } : {}),
    ...('startingArmour' in j ? { startingArmour: j.startingArmour } : {}),
    startingItems: ('startingItems' in j ? j.startingItems : undefined) ?? [],
    startingAmmo: j.startingAmmo,
    startingSkills,
  };
}

export const HERO = heroFor();
