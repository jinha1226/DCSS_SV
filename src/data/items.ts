import itemsRaw from './json/items.json';
import { hasTile, type TileName } from './tiles';
export interface ItemData { readonly id:string; readonly name:string; readonly tile:TileName; readonly kind:string }
export const ITEMS:readonly ItemData[]=itemsRaw.map((row)=>{ if(!hasTile(row.tile)) throw new Error(`items.json: ${row.id}.tile: 없는 타일 ${row.tile}`); return {id:row.id,name:row.name,tile:row.tile as TileName,kind:row.kind}; });
