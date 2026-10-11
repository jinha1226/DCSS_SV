import jobsRaw from './json/jobs.json';
import itemsRaw from './json/items.json';
import speciesRaw from './json/species.json';
import { hasTile, type TileName } from './tiles';

export interface HeroDefinition {
  readonly species:string; readonly job:string; readonly name:string; readonly tile:TileName;
  readonly radius:number; readonly speed:number; readonly sight:number; readonly hp:number; readonly regen:number; readonly give:number;
  readonly walk:{readonly legs:number;readonly mid:number};
  readonly axe:{readonly damage:number;readonly reach:number;readonly every:number;readonly knock:number};
  readonly thrown:{readonly damage:number;readonly range:number;readonly speed:number;readonly every:number;readonly knock:number};
  readonly horns:{readonly damage:number;readonly reach:number;readonly every:number;readonly knock:number;readonly stun:number};
  readonly aptitudes:Readonly<Record<string,number>>;
}
type SpeciesRow=(typeof speciesRaw)[number]; type JobRow=(typeof jobsRaw)[number]; type ItemRow=(typeof itemsRaw)[number];
function species(id:string):SpeciesRow { const row=speciesRaw.find((e)=>e.id===id); if(!row) throw new Error(`species.json: ${id}: 없는 종족`); if(!hasTile(row.tile)) throw new Error(`species.json: ${id}.tile: 없는 타일 ${row.tile}`); return row; }
function job(id:string):JobRow { const row=jobsRaw.find((e)=>e.id===id); if(!row) throw new Error(`jobs.json: ${id}: 없는 직업`); return row; }
function item(id:string):ItemRow { const row=itemsRaw.find((e)=>e.id===id); if(!row) throw new Error(`items.json: ${id}: 없는 아이템`); if(!hasTile(row.tile)) throw new Error(`items.json: ${id}.tile: 없는 타일 ${row.tile}`); return row; }
function numberField(row:object,key:string,where:string):number { const value=(row as Record<string,unknown>)[key]; if(typeof value!=='number') throw new Error(`items.json: ${where}.${key}: 숫자가 아님`); return value; }
export function heroFor(speciesId='minotaur',jobId='berserker'):HeroDefinition {
  const s=species(speciesId), j=job(jobId), axe=item(j.startingWeapon), thrown=item(j.startingThrow);
  if(axe.kind!=='axe') throw new Error(`jobs.json: ${j.id}.startingWeapon: 도끼가 아님`);
  if(thrown.kind!=='throw') throw new Error(`jobs.json: ${j.id}.startingThrow: 투척 무기가 아님`);
  return {
    species:s.id,job:j.id,name:`${s.name} ${j.name}`,tile:s.tile as TileName,
    radius:s.radius,speed:s.speed,sight:s.sight,hp:s.hp,regen:s.regen,give:s.give,walk:s.walk,horns:s.horns,aptitudes:s.aptitudes,
    axe:{damage:numberField(axe,'damage',axe.id),reach:numberField(axe,'reach',axe.id),every:numberField(axe,'every',axe.id),knock:numberField(axe,'knock',axe.id)},
    thrown:{damage:numberField(thrown,'damage',thrown.id),range:numberField(thrown,'range',thrown.id),speed:numberField(thrown,'speed',thrown.id),every:numberField(thrown,'every',thrown.id),knock:numberField(thrown,'knock',thrown.id)},
  };
}
export const HERO=heroFor();
