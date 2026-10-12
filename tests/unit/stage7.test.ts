import { describe, expect, it } from 'vitest';
import { heroFor, type HeroDefinition } from '../../src/data/hero';
import { plainAxe } from '../../src/data/items';
import { throwTarget } from '../../src/sim/combat';
import { hurtHero } from '../../src/sim/effects';
import { carve, makeGrid } from '../../src/sim/grid';
import { spawnMonster } from '../../src/sim/monster';
import { dealSkillChoices, openSkill, skillCap, skillLevel } from '../../src/sim/skills';
import { makeWorld } from '../../src/sim/world';

function definition(aptitudes: HeroDefinition['aptitudes'] = heroFor().aptitudes): HeroDefinition {
  return {
    ...heroFor(),
    species: 'test-species',
    job: 'test-job',
    name: '시험 캐릭터',
    traits: [],
    aptitudes,
    startingSkills: { axe: 1 },
  };
}

function openFloor() {
  const grid = makeGrid(31, 31);
  carve(grid, 1, 1, 29, 29);
  return {
    grid,
    start: { x: 15.5, y: 15.5 },
    rooms: [{ x: 1, y: 1, w: 29, h: 29 }],
  };
}

describe('stage 7 character data', () => {
  it('runs a test-only character definition without changing game data', () => {
    const w = makeWorld({ definition: definition(), floor: openFloor(), monsters: false, items: false });
    expect(w.heroDef.name).toBe('시험 캐릭터');
    expect(skillLevel(w, 'axe')).toBe(1);
  });

  it('starts the berserker with axe, fighting and dodging one', () => {
    const w = makeWorld({ floor: openFloor(), monsters: false, items: false });
    expect(w.hero.skills).toMatchObject({ axe: 1, fighting: 1, dodging: 1 });
    expect(w.openSkills).toEqual(new Set(['axe', 'fighting', 'dodging']));
  });
});

describe('legacy skill card compatibility', () => {
  it('keeps the direct skill-card helper available independently of automatic training', () => {
    const w = makeWorld({ floor: openFloor(), monsters: false, items: false });
    w.pendingChoices = 1;
    dealSkillChoices(w);
    expect(w.choosing).toHaveLength(3);
    expect(w.choosing!.every((card) => card.cap === 27)).toBe(true);
  });

  it('keeps unlocked training progress after a weapon swap', () => {
    const w = makeWorld({ floor: openFloor(), monsters: false, items: false });
    openSkill(w, 'axe');
    w.weapon = plainAxe('battle_axe', 'other');
    expect(w.openSkills.has('axe')).toBe(true);
    expect(skillCap(w, 'axe')).toBe(27);
  });
});

describe('stage 7 sight and traits', () => {
  it('sees seven cells away but not eight', () => {
    const w = makeWorld({ floor: openFloor(), monsters: false, items: false });
    const x = Math.floor(w.hero.x);
    const y = Math.floor(w.hero.y);
    expect(w.visible[y * w.grid.w + x + 7]).toBe(1);
    expect(w.visible[y * w.grid.w + x + 8]).toBe(0);
  });

  it('never targets an unseen monster with throwing', () => {
    const w = makeWorld({ floor: openFloor(), monsters: false, items: false });
    spawnMonster(w, 'ogre', w.hero.x + 8, w.hero.y, true);
    expect(throwTarget(w)).toBeUndefined();
  });

  it('headbutts back after a melee dodge and block, but not a stone', () => {
    const dodge = makeWorld({ floor: openFloor(), monsters: false, items: false });
    dodge.hero.skills.dodging = 8;
    const attacker = spawnMonster(dodge, 'ogre', dodge.hero.x + 1, dodge.hero.y, true);
    Object.defineProperty(dodge, 'rng', { value: () => 0 });
    const hp = attacker.hp;
    hurtHero(dodge, 10, 'melee', attacker);
    expect(attacker.hp).toBeLessThan(hp);
    expect(dodge.events.some((event) => event.type === 'hit' && event.by === 'headbutt_back')).toBe(true);

    const block = makeWorld({ floor: openFloor(), monsters: false, items: false });
    block.hero.skills.shield = 8;
    block.gear.offhand = 'buckler';
    const blocker = spawnMonster(block, 'ogre', block.hero.x + 1, block.hero.y, true);
    Object.defineProperty(block, 'rng', { value: () => 0.15 });
    const blockHp = blocker.hp;
    hurtHero(block, 10, 'melee', blocker);
    expect(blocker.hp).toBeLessThan(blockHp);

    const stone = makeWorld({ floor: openFloor(), monsters: false, items: false });
    stone.hero.skills.dodging = 8;
    const thrower = spawnMonster(stone, 'kobold', stone.hero.x + 1, stone.hero.y, true);
    Object.defineProperty(stone, 'rng', { value: () => 0 });
    const stoneHp = thrower.hp;
    hurtHero(stone, 4, 'stone', thrower);
    expect(thrower.hp).toBe(stoneHp);
  });
});

describe('path unlock items removed', () => {
  it('no longer places unlock items on a newly created floor', () => {
    const w = makeWorld({ floor: openFloor(), monsters: false, items: true });
    expect(w.groundItems.map((item) => item.kind).includes('path')).toBe(false);
  });
});
