import dungeonRaw from './json/dungeon.json';
import monstersRaw from './json/monsters.json';
import { hasTile, type TileName } from './tiles';
export interface MonsterStats { readonly hp:number; readonly xp:number; readonly radius:number; readonly speed:number; readonly damage:number; readonly reach:number; readonly windup:number; readonly rest:number; readonly notice:number; readonly throws?:{readonly range:number;readonly keep:number;readonly speed:number}; readonly flits?:number; readonly poison?:number }
export interface MonsterKind { readonly id:string; readonly name:string; readonly tile:TileName; readonly role:string; readonly stats:MonsterStats }
export const MONSTERS:readonly MonsterKind[]=monstersRaw.map((row)=>{
  if(!hasTile(row.tile)) throw new Error(`monsters.json: ${row.id}.tile: 없는 타일 ${row.tile}`);
  const stats:MonsterStats={hp:row.hp,xp:row.xp,radius:row.radius,speed:row.speed,damage:row.damage,reach:row.reach,windup:row.windup,rest:row.rest,notice:row.notice,
    ...('throws' in row?{throws:row.throws}:{}),...('flits' in row?{flits:row.flits}:{}),...('poison' in row?{poison:row.poison}:{})};
  return {id:row.id,name:row.name,tile:row.tile as TileName,role:row.role,stats};
});
export const POISON=dungeonRaw.poisonPerSecond;
export function monsterKind(id:string):MonsterKind { const kind=MONSTERS.find((m)=>m.id===id); if(!kind) throw new Error(`monsters.json: ${id}: 없는 몬스터`); return kind; }
