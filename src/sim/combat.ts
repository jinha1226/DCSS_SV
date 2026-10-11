import { POISON } from '../data/monsters';
import { DUNGEON } from '../data/packs';
import { hurtHero, wake } from './effects';
import { FAR } from './flow';
import { walkable } from './grid';
import { effectValue, gainExperience, hasEffect, hornDamage, hornEvery, skillLevel, throwCooldown } from './skills';
import type { Monster, Shot, World } from './types';

export const KNOCK_FADE=14;

export function noise(w:World,steps:number):void {
  for(const m of w.monsters) {
    if(m.awake) continue;
    const d=w.flow.dist[Math.floor(m.y)*w.grid.w+Math.floor(m.x)]??FAR;
    if(d<=steps) wake(w,m);
  }
}

function power(w:World,amount:number):number {
  const scale=w.hero.hp<=w.hero.maxHp*0.3?effectValue(w,'fighting.desperate'):0;
  return Math.round(amount*(scale||1));
}

function strike(w:World,m:Monster,amount:number,knock:number,by:'axe'|'horns'|'throw',dx:number,dy:number):boolean {
  if(m.hp<=0) return false;
  amount=power(w,amount);
  const d=Math.hypot(dx,dy);
  m.hp-=amount;m.flash=0.12;wake(w,m);
  m.kx=d>1e-4?(dx/d)*knock:w.hero.facing*knock;
  m.ky=d>1e-4?(dy/d)*knock:0;
  w.events.push({type:'hit',x:m.x,y:m.y,amount,by});
  if(m.hp>0) return false;
  w.kills++;
  gainExperience(w,m.stats.xp);
  const heal=effectValue(w,'fighting.healKill');
  if(heal>0) w.hero.hp=Math.min(w.hero.maxHp,w.hero.hp+heal);
  w.events.push({type:'kill',x:m.x,y:m.y});
  return true;
}

function mend(w:World,dt:number):void {
  const hero=w.hero;
  if(hero.hurt>0) hero.hurt-=dt;
  if(hero.invulnerable>0) hero.invulnerable-=dt;
  if(hero.poison>0) {
    hero.poison-=dt;
    hero.hp=Math.max(0,hero.hp-POISON*dt);
    if(hero.hp<=0) w.over=true;
  } else {
    const regen=w.heroDef.regen*(effectValue(w,'fighting.regen')||1);
    hero.hp=Math.min(hero.maxHp,hero.hp+regen*dt);
  }
}

function rankedTargets(w:World):Monster[] {
  return w.monsters.filter((m)=>{
    if(m.hp<=0||!w.visible[Math.floor(m.y)*w.grid.w+Math.floor(m.x)]) return false;
    return Math.hypot(m.x-w.hero.x,m.y-w.hero.y)<=w.heroDef.thrown.range;
  }).sort((a,b)=>{
    const rank=(m:Monster):number=>(m.stats.throws&&m.awake?0:m.awake?100:200)+Math.hypot(m.x-w.hero.x,m.y-w.hero.y);
    return rank(a)-rank(b);
  });
}
export function throwTarget(w:World):Monster|undefined { return rankedTargets(w)[0]; }

function makeShot(w:World,target:Monster):Shot {
  const hero=w.hero,t=w.heroDef.thrown;
  const dx=target.x-hero.x,dy=target.y-hero.y,d=Math.hypot(dx,dy)||1;
  return {x:hero.x,y:hero.y,px:hero.x,py:hero.y,vx:(dx/d)*t.speed,vy:(dy/d)*t.speed,
    damage:t.damage+effectValue(w,'throwing.power'),left:(t.range+1.5)/t.speed,mine:true,
    pierce:Math.round(effectValue(w,'throwing.pierce')),returns:hasEffect(w,'throwing.return'),returning:false,hit:[]};
}

function throwNow(w:World):void {
  const targets=rankedTargets(w);
  if(!targets.length) return;
  const count=hasEffect(w,'throwing.double')?Math.round(effectValue(w,'throwing.double')):1;
  for(const target of targets.slice(0,count)) w.shots.push(makeShot(w,target));
  const first=targets[0]!;
  const dx=first.x-w.hero.x;
  if(Math.abs(dx)>0.15) w.hero.facing=dx<0?-1:1;
  w.hero.throwing=throwCooldown(w);
  w.events.push({type:'throw',x:w.hero.x,y:w.hero.y});
}

function turnBack(w:World,s:Shot):void {
  s.returning=true;s.hit.length=0;s.left=10;
  const dx=w.hero.x-s.x,dy=w.hero.y-s.y,d=Math.hypot(dx,dy)||1;
  s.vx=(dx/d)*w.heroDef.thrown.speed;s.vy=(dy/d)*w.heroDef.thrown.speed;
}

function flyShots(w:World,dt:number):void {
  let kept=0;
  for(const s of w.shots) {
    s.px=s.x;s.py=s.y;
    if(s.returning) {
      const dx=w.hero.x-s.x,dy=w.hero.y-s.y,d=Math.hypot(dx,dy)||1;
      if(d<=w.heroDef.radius+0.2) continue;
      s.vx=(dx/d)*w.heroDef.thrown.speed;s.vy=(dy/d)*w.heroDef.thrown.speed;
    }
    s.x+=s.vx*dt;s.y+=s.vy*dt;s.left-=dt;
    const open=walkable(w.grid,Math.floor(s.x),Math.floor(s.y));
    if((s.left<=0||!open)&&s.mine&&s.returns&&!s.returning) { turnBack(w,s);w.shots[kept++]=s;continue; }
    if(s.left<=0||!open) continue;

    if(s.mine) {
      const hit=w.monsters.find((m)=>m.hp>0&&!s.hit.includes(m)&&Math.hypot(m.x-s.x,m.y-s.y)<=m.stats.radius+0.2);
      if(hit) {
        s.hit.push(hit);
        strike(w,hit,s.damage,w.heroDef.thrown.knock,'throw',s.vx,s.vy);
        const slow=effectValue(w,'throwing.slow');
        if(slow>0) hit.slow=Math.max(hit.slow,effectValue(w,'throwing.slowTime'));
        if(!s.returning&&s.pierce>0) s.pierce--;
        else if(!s.returning&&!s.returns) continue;
      }
    } else if(Math.hypot(s.x-w.hero.x,s.y-w.hero.y)<=w.heroDef.radius+0.12) {
      hurtHero(w,s.damage,'stone');
      continue;
    }
    w.shots[kept++]=s;
  }
  w.shots.length=kept;
}

export function heroStrikes(w:World,dt:number,wantsThrow:boolean):void {
  const hero=w.hero;
  mend(w,dt);flyShots(w,dt);
  if(w.over) return;
  hero.swing-=dt;hero.butt-=dt;if(hero.throwing>0) hero.throwing-=dt;
  if(wantsThrow&&hero.throwing<=0) throwNow(w);

  if(hero.swing<=0) {
    const axeLevel=skillLevel(w,'axe');
    const baseReach=w.heroDef.axe.reach+(axeLevel>=2?effectValue(w,'axe.wide'):0);
    const nextSwing=hero.axeSwings+1;
    const spin=axeLevel>=4&&nextSwing%3===0?effectValue(w,'axe.spin'):1;
    const reach=baseReach*spin;
    const damage=(w.heroDef.axe.damage+effectValue(w,'axe.damage'))*spin;
    let any=false,kill=false;
    for(const m of w.monsters) {
      if(m.hp<=0||Math.hypot(m.x-hero.x,m.y-hero.y)-m.stats.radius>reach) continue;
      if(!any) w.events.push({type:'swing',x:hero.x,y:hero.y,reach:reach+0.3});
      any=true;
      kill=strike(w,m,Math.round(damage),w.heroDef.axe.knock,'axe',m.x-hero.x,m.y-hero.y)||kill;
      if(m.hp>0&&hasEffect(w,'axe.stun')) m.stun=Math.max(m.stun,effectValue(w,'axe.stun'));
    }
    if(any) {
      hero.axeSwings=nextSwing;
      hero.swing=kill&&hasEffect(w,'axe.reset')?0:w.heroDef.axe.every;
      noise(w,DUNGEON.loud);
    } else hero.swing=0;
  }

  if(hero.butt<=0) {
    let nearest:Monster|undefined,best=Infinity;
    for(const m of w.monsters) {
      if(m.hp<=0) continue;
      const d=Math.hypot(m.x-hero.x,m.y-hero.y)-m.stats.radius;
      if(d<=w.heroDef.horns.reach&&d<best) {best=d;nearest=m;}
    }
    if(nearest) {
      strike(w,nearest,hornDamage(w),w.heroDef.horns.knock,'horns',nearest.x-hero.x,nearest.y-hero.y);
      nearest.stun=w.heroDef.horns.stun;nearest.wind=-1;hero.butt=hornEvery(w);
    } else hero.butt=0;
  }

  let kept=0;
  for(const m of w.monsters) if(m.hp>0) w.monsters[kept++]=m;
  w.monsters.length=kept;
}
