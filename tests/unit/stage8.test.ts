import { describe, expect, it } from 'vitest';
import { plainAxe, plainBow } from '../../src/data/items';
import { DUNGEON } from '../../src/data/packs';
import { bowTarget } from '../../src/sim/combat';
import { hurtHero } from '../../src/sim/effects';
import { acceptPickup, collectGround } from '../../src/sim/equipment';
import { Cell, carve, makeGrid, setCell } from '../../src/sim/grid';
import { tryHop } from '../../src/sim/hop';
import { spawnMonster } from '../../src/sim/monster';
import { dealSkillChoices, effectValue } from '../../src/sim/skills';
import { makeWorld, stepWorld, type World } from '../../src/sim/world';

function openFloor() {
  const grid = makeGrid(35, 35);
  carve(grid, 1, 1, 33, 33);
  return { grid, start: { x: 17.5, y: 17.5 }, rooms: [{ x: 1, y: 1, w: 33, h: 33 }] };
}
function hunter(seed = 1): World {
  return makeWorld({ species: 'barachi', job: 'hunter', seed, floor: openFloor(), monsters: false, items: false });
}
function berserker(seed = 1): World {
  return makeWorld({ species: 'minotaur', job: 'berserker', seed, floor: openFloor(), monsters: false, items: false });
}
function run(w: World, seconds: number, input = { mx: 0, my: 0 }): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) stepWorld(w, input);
}

describe('stage 8 Barachi hunter', () => {
  it('starts slower, sees radius eight, and starts with bow but no throwing', () => {
    const w = hunter();
    expect(w.heroDef.speed).toBe(5.4);
    expect(w.heroDef.sight).toBe(8);
    expect(w.weapon.family).toBe('ranged');
    expect(w.hero.skills).toMatchObject({ ranged: 2, fighting: 1, dodging: 1 });
    expect(w.openSkills.has('ranged')).toBe(true);
    expect(w.openSkills.has('throwing')).toBe(false);
    const x = Math.floor(w.hero.x),
      y = Math.floor(w.hero.y);
    expect(w.visible[y * w.grid.w + x + 8]).toBe(1);
    expect(w.visible[y * w.grid.w + x + 9]).toBe(0);
  });

  it('uses the same generated floor for both characters with the same seed', () => {
    const a = makeWorld({ species: 'minotaur', job: 'berserker', seed: 90210, monsters: false, items: false });
    const b = makeWorld({ species: 'barachi', job: 'hunter', seed: 90210, monsters: false, items: false });
    expect(Array.from(a.grid.cells)).toEqual(Array.from(b.grid.cells));
    expect(a.rooms).toEqual(b.rooms);
  });
});

describe('automatic bow fire', () => {
  it('targets the nearest awake enemy and ignores sleepers', () => {
    const w = hunter();
    const sleeper = spawnMonster(w, 'goblin', w.hero.x + 2, w.hero.y, false);
    const near = spawnMonster(w, 'goblin', w.hero.x + 4, w.hero.y, true);
    spawnMonster(w, 'ogre', w.hero.x + 6, w.hero.y, true);
    expect(bowTarget(w)).toBe(near);
    expect(bowTarget(w)).not.toBe(sleeper);
  });

  it('prioritises an awake thrower over a nearer melee enemy', () => {
    const w = hunter();
    spawnMonster(w, 'goblin', w.hero.x + 3, w.hero.y, true);
    const kobold = spawnMonster(w, 'kobold', w.hero.x + 6, w.hero.y, true);
    expect(bowTarget(w)).toBe(kobold);
  });

  it('keeps firing while walking and stays inside weapon range', () => {
    const w = hunter();
    const target = spawnMonster(w, 'ogre', w.hero.x + 6, w.hero.y, true);
    target.stun = 99;
    const before = w.hero.x;
    stepWorld(w, { mx: -1, my: 0 });
    expect(w.hero.x).toBeLessThan(before);
    expect(w.shots.some((shot) => shot.arrow)).toBe(true);

    const far = hunter();
    far.visible.fill(1);
    spawnMonster(far, 'ogre', far.hero.x + 8.5, far.hero.y, true).stun = 99;
    expect(bowTarget(far)).toBeUndefined();
  });

  it('an arrow is stopped by a wall before a monster', () => {
    const w = hunter();
    w.weapon = plainAxe('hand_axe', 'quiet');
    const monster = spawnMonster(w, 'ogre', w.hero.x + 5, w.hero.y, true);
    monster.stun = 99;
    const wallX = Math.floor(w.hero.x + 2);
    setCell(w.grid, wallX, Math.floor(w.hero.y), Cell.Wall);
    const hp = monster.hp;
    w.shots.push({
      x: w.hero.x,
      y: w.hero.y,
      px: w.hero.x,
      py: w.hero.y,
      vx: 20,
      vy: 0,
      damage: 20,
      left: 1,
      mine: true,
      pierce: 0,
      returns: false,
      returning: false,
      hit: [],
      arrow: true,
    });
    run(w, 0.5);
    expect(monster.hp).toBe(hp);
    expect(w.shots.some((shot) => shot.arrow)).toBe(false);
  });

  it('a bow is two-handed, so shield effects and cards rest', () => {
    const w = hunter();
    w.hero.skills.shield = 8;
    expect(effectValue(w, 'shield.chance')).toBe(0);
    w.pendingChoices = 1;
    dealSkillChoices(w);
    expect(w.choosing!.some((card) => card.id === 'shield')).toBe(false);
  });
});

describe('bow skill', () => {
  it('adds damage and speed every level and range at two', () => {
    const w = hunter();
    w.hero.skills.ranged = 2;
    expect(effectValue(w, 'ranged.damage')).toBeCloseTo(0.9);
    expect(effectValue(w, 'ranged.haste')).toBeCloseTo(-0.024);
    expect(effectValue(w, 'ranged.range')).toBe(1);
  });

  it('pierces one extra enemy at four', () => {
    const w = hunter();
    w.hero.skills.ranged = 4;
    const a = spawnMonster(w, 'ogre', w.hero.x + 3, w.hero.y, true),
      b = spawnMonster(w, 'ogre', w.hero.x + 5, w.hero.y, true);
    a.stun = b.stun = 99;
    const ah = a.hp,
      bh = b.hp;
    stepWorld(w, { mx: 0, my: 0 });
    run(w, 0.4);
    expect(a.hp).toBeLessThan(ah);
    expect(b.hp).toBeLessThan(bh);
  });

  it('stuns at six', () => {
    const w = hunter();
    w.hero.skills.ranged = 6;
    const m = spawnMonster(w, 'ogre', w.hero.x + 4, w.hero.y, true);
    const hp = m.hp;
    stepWorld(w, { mx: 0, my: 0 });
    run(w, 0.3);
    expect(m.hp).toBeLessThan(hp);
    expect(m.stun).toBeGreaterThan(0);
  });

  it('fires two arrows at eight, including twice at one target', () => {
    const w = hunter();
    w.hero.skills.ranged = 8;
    spawnMonster(w, 'ogre', w.hero.x + 5, w.hero.y, true).stun = 99;
    stepWorld(w, { mx: 0, my: 0 });
    expect(w.shots.filter((shot) => shot.arrow)).toHaveLength(2);
  });

  it('the piercing artefact crosses every enemy to the end of its range', () => {
    const w = hunter();
    w.weapon = { ...plainBow('longbow', 'piercer'), name: '꿰는 활', tile: 'item/longbow2', effect: 'pierce_all', special: true };
    const monsters = [3, 5, 7].map((d) => spawnMonster(w, 'ogre', w.hero.x + d, w.hero.y, true));
    for (const m of monsters) m.stun = 99;
    const hp = monsters.map((m) => m.hp);
    stepWorld(w, { mx: 0, my: 0 });
    run(w, 0.5);
    monsters.forEach((m, i) => expect(m.hp).toBeLessThan(hp[i]!));
  });

  it('arrow noise is exactly half axe noise', () => {
    expect(DUNGEON.arrowLoud).toBe(DUNGEON.loud / 2);
  });
});

describe('Barachi hop', () => {
  it('jumps three cells in stick direction, or facing when still', () => {
    const w = hunter(),
      x = w.hero.x;
    expect(tryHop(w, { mx: 1, my: 0 })).toBe(true);
    expect(w.hero.x).toBeCloseTo(x + 3, 1);
    const still = hunter();
    still.hero.facing = -1;
    const sx = still.hero.x;
    expect(tryHop(still, { mx: 0, my: 0 })).toBe(true);
    expect(still.hero.x).toBeCloseTo(sx - 3, 1);
  });

  it('stops before a wall but passes over monsters', () => {
    const wall = hunter();
    const wx = Math.floor(wall.hero.x + 2);
    setCell(wall.grid, wx, Math.floor(wall.hero.y), Cell.Wall);
    const start = wall.hero.x;
    tryHop(wall, { mx: 1, my: 0 });
    expect(wall.hero.x).toBeGreaterThan(start);
    expect(wall.hero.x).toBeLessThan(start + 2);

    const over = hunter();
    const obstacle = spawnMonster(over, 'ogre', over.hero.x + 1.5, over.hero.y, true);
    obstacle.stun = 99;
    const ox = over.hero.x;
    tryHop(over, { mx: 1, my: 0 });
    expect(over.hero.x).toBeGreaterThan(ox + 2.5);
  });

  it('moves off an occupied landing point', () => {
    const w = hunter();
    const intended = w.hero.x + 3;
    const m = spawnMonster(w, 'ogre', intended, w.hero.y, true);
    m.stun = 99;
    tryHop(w, { mx: 1, my: 0 });
    expect(Math.hypot(w.hero.x - m.x, w.hero.y - m.y)).toBeGreaterThan(w.heroDef.radius + m.stats.radius);
  });

  it('is invulnerable in flight and obeys cooldown', () => {
    const w = hunter();
    const attacker = spawnMonster(w, 'ogre', w.hero.x + 1, w.hero.y, true);
    tryHop(w, { mx: 1, my: 0 });
    const hp = w.hero.hp;
    expect(hurtHero(w, 20, 'melee', attacker)).toBe(false);
    expect(w.hero.hp).toBe(hp);
    expect(tryHop(w, { mx: 1, my: 0 })).toBe(false);
    w.monsters.length = 0;
    run(w, 6.1);
    expect(tryHop(w, { mx: 1, my: 0 })).toBe(true);
  });

  it('jumps four cells from level seven', () => {
    const w = hunter();
    w.hero.level = 7;
    const x = w.hero.x;
    tryHop(w, { mx: 1, my: 0 });
    expect(w.hero.x).toBeCloseTo(x + 4, 1);
  });
});

describe('weapon-driven training', () => {
  it('trains ranged only after equipping a ranged weapon', () => {
    const w = berserker();
    const bow = plainBow('shortbow', 'found-bow');
    w.groundItems.push({ uid: bow.uid, kind: 'axe', x: w.hero.x, y: w.hero.y, axe: bow, ignored: false });
    collectGround(w);
    acceptPickup(w);
    expect(w.weapon.family).toBe('ranged');
    expect(w.openSkills.has('ranged')).toBe(true);
  });
});
