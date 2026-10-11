import jobsRaw from './json/jobs.json';
import speciesRaw from './json/species.json';
import { axeBase, THROW_DATA } from './items';
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
  readonly aptitudes: Readonly<Record<string, Aptitude>>;
  readonly startingWeapon: string;
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
  axeBase(row.startingWeapon);
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
  const axe = axeBase(j.startingWeapon);
  return {
    species: s.id,
    job: j.id,
    name: s.name + ' ' + j.name,
    tile: s.tile as TileName,
    radius: s.radius,
    speed: s.speed,
    sight: s.sight,
    hp: s.hp,
    regen: s.regen,
    give: s.give,
    walk: s.walk,
    axe: { damage: axe.damage, reach: axe.reach, every: axe.every, knock: axe.knock },
    thrown: THROW_DATA,
    traits: s.traits as readonly TraitData[],
    aptitudes: s.aptitudes as Readonly<Record<string, Aptitude>>,
    startingWeapon: j.startingWeapon,
    startingSkills: j.startingSkills,
  };
}

export const HERO = heroFor();
