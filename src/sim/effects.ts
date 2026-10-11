import { weaponOption } from './equipment';
import { recordKill } from './kills';
import { effectValue, hasEffect } from './skills';
import type { Monster, World } from './types';

export type HurtKind='melee'|'stone';
export function hurtHero(w:World,amount:number,kind:HurtKind='melee',source?:Monster):boolean{
  const hero=w.hero;if(hero.invulnerable>0)return false;
  const dodge=effectValue(w,'dodging.chance')+weaponOption(w.weapon,'evasion');
  if(dodge>0&&w.rng()<dodge){w.events.push({type:'dodge',x:hero.x,y:hero.y});if(source&&hasEffect(w,'dodging.delay'))source.rest+=effectValue(w,'dodging.delay');const grace=effectValue(w,'dodging.grace');if(grace>0)hero.invulnerable=Math.max(hero.invulnerable,grace);return false;}
  let block=effectValue(w,'shield.chance');if(kind==='stone'&&hasEffect(w,'shield.missile'))block*=effectValue(w,'shield.missile');
  if(block>0&&w.rng()<Math.min(1,block)){w.events.push({type:'block',x:hero.x,y:hero.y});if(source&&hasEffect(w,'shield.push')){const dx=source.x-hero.x,dy=source.y-hero.y,d=Math.hypot(dx,dy)||1,push=effectValue(w,'shield.push');source.kx=dx/d*push;source.ky=dy/d*push;}if(source&&hasEffect(w,'shield.stun'))source.stun=Math.max(source.stun,effectValue(w,'shield.stun'));if(hasEffect(w,'shield.reset'))hero.swing=0;return false;}
  if(kind==='stone'&&hasEffect(w,'armour.stone'))amount=Math.ceil(amount*effectValue(w,'armour.stone'));const weak=effectValue(w,'armour.deflect');if(weak>0&&amount<=weak)return false;amount=Math.max(1,amount-effectValue(w,'armour.reduce')-weaponOption(w.weapon,'armour'));
  if(source&&hasEffect(w,'armour.thorns')){const thorn=effectValue(w,'armour.thorns');source.hp-=thorn;source.flash=.12;w.events.push({type:'hit',x:source.x,y:source.y,amount:thorn,by:'thorns'});recordKill(w,source);}
  if(amount>=hero.hp&&hasEffect(w,'fighting.lastStand')&&!hero.lastStandUsed){const taken=Math.max(0,hero.hp-1);hero.hp=1;hero.lastStandUsed=true;hero.invulnerable=1;hero.hurt=.2;w.events.push({type:'hurt',x:hero.x,y:hero.y,amount:taken});return true;}
  hero.hp=Math.max(0,hero.hp-amount);hero.hurt=.2;w.events.push({type:'hurt',x:hero.x,y:hero.y,amount});if(hero.hp<=0)w.over=true;return true;
}
export function wake(w:World,m:Monster):void{if(m.awake)return;for(const other of w.monsters){if(other.pack!==m.pack||other.awake)continue;other.awake=true;other.rest=Math.max(other.rest,w.rng()*.5);}w.events.push({type:'wake',x:m.x,y:m.y});}
