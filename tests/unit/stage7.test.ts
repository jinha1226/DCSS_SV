import { describe, expect, it } from 'vitest';
import { heroFor, type HeroDefinition } from '../../src/data/hero';
import { plainAxe } from '../../src/data/items';
import { throwTarget } from '../../src/sim/combat';
import { hurtHero } from '../../src/sim/effects';
import { placeNewPath } from '../../src/sim/equipment';
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
    expect(w.openSkills).toEqual(new Set(['fighting', 'armour', 'dodging', 'spellcasting', 'shield', 'axe', 'throwing']));
  });
});

describe('stage 7 skill cards', () => {
  it('only deals opened skills and guarantees a newly opened skill once', () => {
    const w = makeWorld({ floor: openFloor(), monsters: false, items: false });
    w.openSkills.clear();
    openSkill(w, 'fighting', false);
    openSkill(w, 'armour', false);
    openSkill(w, 'dodging', false);
    openSkill(w, 'throwing');
    w.pendingChoices = 1;
    dealSkillChoices(w);
    expect(w.choosing!.map((card) => card.id)).toContain('throwing');
    expect(w.choosing!.every((card) => w.openSkills.has(card.id))).toBe(true);
  });

  it('legacy card helper supports +2 while every aptitude now caps at 27', () => {
    const good = makeWorld({ floor: openFloor(), monsters: false, items: false });
    good.openSkills.clear();
    good.openSkills.add('axe');
    let sawTwo = false;
    for (let i = 0; i < 30; i++) {
      good.choosing = null;
      good.pendingChoices = 1;
      dealSkillChoices(good);
      const card = good.choosing![0]!;
      if (card.gain === 2) sawTwo = true;
      good.pendingChoices = 0;
    }
    expect(sawTwo).toBe(true);

    const badDef = definition({ ...heroFor().aptitudes, armour: 'bad' });
    const bad = makeWorld({ definition: badDef, floor: openFloor(), monsters: false, items: false });
    bad.hero.skills.armour = 27;
    expect(skillCap(bad, 'armour')).toBe(27);
    bad.openSkills.clear();
    bad.openSkills.add('armour');
    bad.pendingChoices = 1;
    bad.hero.hp = 1;
    dealSkillChoices(bad);
    expect(bad.choosing).toBeNull();
    expect(bad.pendingChoices).toBe(0);
    expect(bad.hero.hp).toBe(bad.hero.maxHp);
  });

  it('weights good aptitude above normal with the same deterministic run', () => {
    const w = makeWorld({ seed: 12345, floor: openFloor(), monsters: false, items: false });
    w.openSkills.clear();
    for (const id of ['axe', 'fighting', 'dodging', 'throwing']) w.openSkills.add(id);
    const counts = new Map<string, number>();
    for (let i = 0; i < 1000; i++) {
      w.choosing = null;
      w.pendingChoices = 1;
      dealSkillChoices(w);
      for (const card of w.choosing!) counts.set(card.id, (counts.get(card.id) ?? 0) + 1);
      w.pendingChoices = 0;
    }
    expect(counts.get('axe')!).toBeGreaterThan(counts.get('throwing')!);
  });

  it('keeps opened weapon skills after swapping away', () => {
    const w = makeWorld({ floor: openFloor(), monsters: false, items: false });
    openSkill(w, 'axe');
    w.weapon = plainAxe('battle_axe', 'other');
    expect(w.openSkills.has('axe')).toBe(true);
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
    block.gear.shield = 'buckler';
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

describe('stage 7 new path placement', () => {
  it('places one opener for a closed skill and none without an opener', () => {
    const w = makeWorld({ floor: openFloor(), monsters: false, items: false });
    placeNewPath(w, [{ skill: 'bow', id: 'test-bow' }]);
    expect(w.groundItems.filter((item) => item.newPath)).toHaveLength(1);
    const none = makeWorld({ floor: openFloor(), monsters: false, items: false });
    placeNewPath(none, []);
    expect(none.groundItems.filter((item) => item.newPath)).toHaveLength(0);
  });
});
