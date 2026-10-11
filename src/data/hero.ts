import jobsRaw from './json/jobs.json';
import speciesRaw from './json/species.json';
import { axeBase, THROW_DATA } from './items';
import { hasTile, type TileName } from './tiles';

export interface HeroDefinition {
  readonly species:string;readonly job:string;readonly name:string;readonly tile:TileName;
  readonly radius:number;readonly speed:number;readonly sight:number;readonly hp:number;readonly regen:number;readonly give:number;
  readonly walk:{readonly legs:number;readonly mid:number};
  readonly axe:{readonly damage:number;readonly reach:number;readonly every:number;readonly knock:number};
  readonly thrown:{readonly damage:number;readonly range:number;readonly speed:number;readonly every:number;readonly knock:number};
  readonly horns:{readonly damage:number;readonly reach:number;readonly every:number;readonly knock:number;readonly stun:number;readonly damageEveryLevel:number;readonly damageGain:number;readonly speedEveryLevel:number;readonly speedGain:number;readonly minEvery:number};
  readonly aptitudes:Readonly<Record<string,number>>;
  readonly startingWeapon:string;
}
type SpeciesRow=(typeof speciesRaw)[number];type JobRow=(typeof jobsRaw)[number];
function species(id:string):SpeciesRow{const row=speciesRaw.find((e)=>e.id===id);if(!row)throw new Error('species.json: '+id+': 없는 종족');if(!hasTile(row.tile))throw new Error('species.json: '+id+'.tile: 없는 타일 '+row.tile);return row;}
function job(id:string):JobRow{const row=jobsRaw.find((e)=>e.id===id);if(!row)throw new Error('jobs.json: '+id+': 없는 직업');return row;}
export function heroFor(speciesId='minotaur',jobId='berserker'):HeroDefinition{
  const s=species(speciesId),j=job(jobId),axe=axeBase(j.startingWeapon);
  return{species:s.id,job:j.id,name:s.name+' '+j.name,tile:s.tile as TileName,radius:s.radius,speed:s.speed,sight:s.sight,hp:s.hp,regen:s.regen,give:s.give,walk:s.walk,horns:s.horns,aptitudes:s.aptitudes,startingWeapon:j.startingWeapon,
    axe:{damage:axe.damage,reach:axe.reach,every:axe.every,knock:axe.knock},thrown:THROW_DATA};
}
export const HERO=heroFor();
