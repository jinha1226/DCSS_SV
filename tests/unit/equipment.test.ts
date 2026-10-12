import { describe, expect, it } from 'vitest';
import { plainAxe } from '../../src/data/items';
import { applyWeaponBrand, emberBurst, tickBrands } from '../../src/sim/brands';
import { heroStrikes } from '../../src/sim/combat';
import { acceptPickup, artefactAxe, collectGround, declinePickup, dropAmmo, generateAxe, resistanceFactor } from '../../src/sim/equipment';
import { spawnMonster } from '../../src/sim/monster';
import { chooseSkill, effectValue, gainExperience, makeSkillChoice, skillLevel, xpToNext } from '../../src/sim/skills';
import { STEP, makeWorld, stepWorld } from '../../src/sim/world';
import { STILL, arena, run } from './arena';

const grant = (w: ReturnType<typeof arena>, id: string, times = 1): void => {
  for (let i = 0; i < times; i++) {
    w.choosing = [makeSkillChoice(w, id)];
    w.pendingChoices = 1;
    chooseSkill(w, id);
  }
};

describe('axe equipment', () => {
  it('uses the three exact base damage and swing intervals', () => {
    expect(plainAxe('hand_axe')).toMatchObject({ damage: 6, every: 0.6, hands: 1 });
    expect(plainAxe('war_axe')).toMatchObject({ damage: 8, every: 0.75, hands: 1 });
    expect(plainAxe('battle_axe')).toMatchObject({ damage: 11, every: 0.9, hands: 2 });
  });
  it('turns shield off and removes its card while a two handed axe is held', () => {
    const w = arena();
    w.hero.skills.shield = 8;
    w.gear.shield = 'buckler';
    expect(effectValue(w, 'shield.chance')).toBeGreaterThan(0);
    w.weapon = plainAxe('battle_axe', 'two');
    expect(effectValue(w, 'shield.chance')).toBe(0);
    gainExperience(w, xpToNext(1));
    expect(w.rewardChoices?.map((c) => c.kind)).toEqual(['weapon', 'gear', 'consumable']);
    w.weapon = plainAxe('hand_axe', 'one');
    expect(skillLevel(w, 'shield')).toBe(8);
    expect(effectValue(w, 'shield.chance')).toBeGreaterThan(0);
  });
  it('makes deterministic randarts with unique options', () => {
    const a = makeWorld({ seed: 77, items: false, monsters: false }),
      b = makeWorld({ seed: 77, items: false, monsters: false });
    a.depth = b.depth = 3;
    const aa = Array.from({ length: 20 }, () => generateAxe(a)),
      bb = Array.from({ length: 20 }, () => generateAxe(b));
    expect(aa).toEqual(bb);
    for (const axe of aa) expect(new Set(axe.options.map((o) => o.id)).size).toBe(axe.options.length);
  });
  it('can make both special artefact rules', () => {
    const found = new Set<string>();
    for (let seed = 1; seed < 80; seed++) {
      const w = makeWorld({ seed, items: false, monsters: false });
      found.add(artefactAxe(w).effect!);
    }
    expect(found).toEqual(new Set(['ember', 'glut']));
  });
});

describe('brands and resistance', () => {
  it('halves each resistance step, has vulnerability, and immunity at three', () => {
    expect(resistanceFactor(-1)).toBe(2);
    expect(resistanceFactor(0)).toBe(1);
    expect(resistanceFactor(1)).toBe(0.5);
    expect(resistanceFactor(2)).toBe(0.25);
    expect(resistanceFactor(3)).toBe(0);
  });
  it('flame burns and immunity reports a resisted brand', () => {
    const w = arena(),
      m = spawnMonster(w, 'ogre', 11, 10, true);
    w.weapon = { ...plainAxe('war_axe', 'f'), brand: 'flame' };
    applyWeaponBrand(w, m);
    expect(m.burning).toBe(3);
    const before = m.hp;
    tickBrands(w, 1);
    expect(m.hp).toBeCloseTo(before - 2);
    const immune = spawnMonster(w, 'ogre', 12, 10, true);
    Object.defineProperty(immune, 'stats', { value: { ...immune.stats, resists: { fire: 3 } } });
    applyWeaponBrand(w, immune);
    expect(immune.burning).toBe(0);
    expect(w.events.at(-1)).toMatchObject({ type: 'elemental', element: 'fire', amount: 0, target: 'monster' });
  });
  it('cold slows, shock can chain, and vampiric heals', () => {
    const w = arena(),
      a = spawnMonster(w, 'ogre', 11, 10, true),
      b = spawnMonster(w, 'ogre', 12, 10, true);
    w.weapon = { ...plainAxe('war_axe', 'c'), brand: 'cold' };
    applyWeaponBrand(w, a);
    expect(a.slow).toBe(2);
    expect(a.slowScale).toBeCloseTo(0.3);
    w.weapon = { ...plainAxe('war_axe', 's'), brand: 'shock' };
    Object.defineProperty(w, 'rng', { value: () => 0 });
    const hp = b.hp;
    applyWeaponBrand(w, a);
    expect(b.hp).toBe(hp - 5);
    w.hero.hp = 20;
    w.weapon = { ...plainAxe('war_axe', 'v'), brand: 'vampiric' };
    applyWeaponBrand(w, a);
    expect(w.hero.hp).toBe(21);
  });
  it('ember spreads fire and glut rewards a three-target swing', () => {
    const w = arena(),
      dead = spawnMonster(w, 'goblin', 11, 10, true),
      near = spawnMonster(w, 'ogre', 11.8, 10, true);
    dead.burning = 1;
    dead.hp = 0;
    w.weapon = { ...plainAxe('war_axe', 'ember'), brand: 'flame', effect: 'ember', special: true };
    emberBurst(w, dead);
    expect(near.burning).toBeGreaterThan(0);
    const g = arena();
    g.weapon = { ...plainAxe('battle_axe', 'glut'), brand: 'vampiric', effect: 'glut', special: true };
    g.hero.hp = 20;
    g.hero.butt = 1e9;
    spawnMonster(g, 'ogre', 10.8, 10, true);
    spawnMonster(g, 'ogre', 10, 10.8, true);
    spawnMonster(g, 'ogre', 9.2, 10, true);
    heroStrikes(g, STEP, false);
    expect(g.hero.hp).toBeGreaterThanOrEqual(26);
  });
});

describe('floor pickup and ammunition', () => {
  it('pauses on an axe, swaps it, and leaves the old one on the floor', () => {
    const w = arena();
    const found = { ...plainAxe('war_axe', 'found'), uid: 'found' };
    w.groundItems.push({ uid: 'found', kind: 'axe', x: w.hero.x, y: w.hero.y, axe: found, ignored: false });
    collectGround(w);
    expect(w.pendingPickup?.axe).toBe(found);
    const time = w.time;
    stepWorld(w, STILL);
    expect(w.time).toBe(time);
    const old = w.weapon;
    acceptPickup(w);
    expect(w.weapon).toBe(found);
    expect(w.groundItems[0]?.axe).toBe(old);
  });
  it('does not ask again after leave until the pickup radius is clearly left', () => {
    const w = arena(),
      found = { ...plainAxe('war_axe', 'found'), uid: 'found' };
    w.groundItems.push({ uid: 'found', kind: 'axe', x: w.hero.x, y: w.hero.y, axe: found, ignored: false });
    collectGround(w);
    declinePickup(w);
    collectGround(w);
    expect(w.pendingPickup).toBeNull();
    w.hero.x += 1;
    collectGround(w);
    w.hero.x -= 1;
    collectGround(w);
    expect(w.pendingPickup).not.toBeNull();
  });

  it('does not reopen immediately when declined from the neighbouring tile edge', () => {
    const w = arena(),
      found = { ...plainAxe('war_axe', 'edge'), uid: 'edge' };
    w.groundItems.push({ uid: 'edge', kind: 'axe', x: 10.5, y: 10.5, axe: found, ignored: false });
    w.hero.x = 11.01;
    w.hero.y = 10.5;
    collectGround(w);
    expect(w.pendingPickup).not.toBeNull();
    declinePickup(w);
    collectGround(w);
    expect(w.pendingPickup).toBeNull();
    w.hero.x = 11.4;
    collectGround(w);
    w.hero.x = 11.01;
    collectGround(w);
    expect(w.pendingPickup).not.toBeNull();
  });
  it('starts with five, spends ammunition, and drops it on walkable ground', () => {
    const w = arena();
    expect(w.ammo).toBe(w.heroDef.startingAmmo);
    const m = spawnMonster(w, 'ogre', 15, 10, true);
    m.stun = 99;
    stepWorld(w, { mx: 0, my: 0, throw: true });
    expect(w.ammo).toBe(4);
    run(w, 1);
    expect(w.groundItems.some((item) => item.kind === 'ammo')).toBe(true);
  });
  it('picks ammunition up to nine and never drops it in a wall', () => {
    const w = arena();
    w.ammo = 8;
    w.groundItems.push({ uid: 'ammo', kind: 'ammo', x: w.hero.x, y: w.hero.y, count: 3, ignored: false });
    collectGround(w);
    expect(w.ammo).toBe(9);
    expect(w.groundItems[0]?.count).toBe(2);
    dropAmmo(w, 0, 0);
    const item = w.groundItems.at(-1)!;
    expect(item.x).toBeGreaterThan(0);
    expect(item.y).toBeGreaterThan(0);
  });
  it('throwing level four spends two, one if one remains, while level eight returns ammo', () => {
    const w = arena();
    grant(w, 'throwing', 4);
    spawnMonster(w, 'ogre', 14, 9, true).stun = 99;
    spawnMonster(w, 'ogre', 14, 11, true).stun = 99;
    w.ammo = 2;
    stepWorld(w, { mx: 0, my: 0, throw: true });
    expect(w.ammo).toBe(0);
    expect(w.shots).toHaveLength(2);
    const one = arena();
    grant(one, 'throwing', 4);
    spawnMonster(one, 'ogre', 14, 10, true).stun = 99;
    one.ammo = 1;
    stepWorld(one, { mx: 0, my: 0, throw: true });
    expect(one.ammo).toBe(0);
    expect(one.shots).toHaveLength(1);
    const ret = arena();
    grant(ret, 'throwing', 8);
    spawnMonster(ret, 'ogre', 14, 10, true).stun = 99;
    ret.ammo = 1;
    stepWorld(ret, { mx: 0, my: 0, throw: true });
    run(ret, 2);
    expect(ret.ammo).toBe(1);
    expect(ret.groundItems.some((item) => item.kind === 'ammo')).toBe(false);
  });
});
