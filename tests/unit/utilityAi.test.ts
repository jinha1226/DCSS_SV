import { describe, expect, it } from 'vitest';
import { plainWeapon } from '../../src/data/items';
import { itemDefinition } from '../../src/data/itemCatalog';
import { activateItem } from '../../src/sim/itemEffects';
import { monsterContext } from '../../src/sim/ai/context';
import { availableMonsterActions } from '../../src/sim/ai/actions';
import { selectMonsterAction } from '../../src/sim/ai/selector';
import { rankMonsterActions } from '../../src/sim/ai/utility';
import { hurtMonster } from '../../src/sim/hits';
import { spawnMonster } from '../../src/sim/monster';
import { castMonsterSpell } from '../../src/sim/spells';
import { stepWorld, type Monster } from '../../src/sim/world';
import { STILL, quietArena, run } from './arena';

/** Only the test instance is customised; global monster JSON stays immutable. */
function caster(spellId: string, x = 15, y = 10): { monster: Monster; world: ReturnType<typeof quietArena> } {
  const world = quietArena();
  const monster = spawnMonster(world, 'goblin', x, y, true);
  const custom = {
    ...monster,
    stats: {
      ...monster.stats,
      ai: { spells: [spellId], spellBias: 20 },
      windup: 0.05,
      rest: 0.4,
    },
    mana: 40,
    maxMana: 40,
    rest: 0,
  };
  world.monsters[world.monsters.indexOf(monster)] = custom;
  return { world, monster: custom };
}

describe('data-driven utility AI', () => {
  it('scores candidates without changing monster state, then commits the best action', () => {
    const w = quietArena();
    const m = spawnMonster(w, 'kobold', 15, 10, true);
    m.rest = 0;
    const context = monsterContext(w, m);
    const initial = { wind: m.wind, rest: m.rest, x: m.x };
    const choices = rankMonsterActions(context);
    expect(choices[0]?.action).toBe('ranged');
    expect(selectMonsterAction(context)).toEqual(choices[0]);
    expect({ wind: m.wind, rest: m.rest, x: m.x }).toEqual(initial);
    stepWorld(w, STILL);
    expect(m.attackMode).toBe('ranged');
    expect(m.wind).toBeGreaterThanOrEqual(0);
  });

  it('retreats when reloading too close and honours line of sight', () => {
    const w = quietArena();
    const m = spawnMonster(w, 'kobold', 12, 10, true);
    m.rest = 4;
    expect(selectMonsterAction(monsterContext(w, m)).action).toBe('retreat');
    const before = m.x;
    run(w, 0.4);
    expect(m.x).toBeGreaterThan(before);
    expect(itemDefinition(m.stats.throws!.item!).kind).toBe('missile');
  });

  it('obtains bow actions from the same items.json weapon as the player', () => {
    const w = quietArena();
    const original = spawnMonster(w, 'goblin', 15, 10, true);
    const m: Monster = {
      ...original,
      weapon: plainWeapon('shortbow'),
      rest: 0,
      stats: { ...original.stats, windup: 0.05, ai: { preferredRange: 3 } },
    };
    w.monsters[0] = m;
    const actions = availableMonsterActions(monsterContext(w, m));
    expect(actions.some((action) => action.action === 'ranged')).toBe(true);
    run(w, 0.18);
    expect(w.shots.some((shot) => shot.arrow && !shot.mine)).toBe(true);
    expect(w.shots.find((shot) => shot.arrow)?.damage).toBe(m.weapon!.damage);
    expect(w.hero.hp).toBeGreaterThan(0);
  });

  it('rejects spells for insufficient mana and uses shared IDs when funded', () => {
    const { monster: m, world: w } = caster('ember_dart');
    m.mana = 0;
    expect(availableMonsterActions(monsterContext(w, m)).some((a) => a.action === 'spell')).toBe(false);
    m.mana = 40;
    expect(availableMonsterActions(monsterContext(w, m)).some((a) => a.spellId === 'ember_dart')).toBe(true);
    run(w, 0.12);
    expect(m.attackMode).toBe('spell');
    expect(w.spellShots.some((shot) => shot.caster === 'monster' && shot.element === 'fire')).toBe(true);
    const hp = w.hero.hp;
    run(w, 0.5);
    expect(w.hero.hp).toBeLessThan(hp);
    expect(m.mana).toBeLessThan(40);
  });
});

describe('shared spell effect executor for player and monster', () => {
  it('makes hostile projectile and beam respect the existing elemental damage pipeline', () => {
    const projectile = caster('ember_dart');
    expect(castMonsterSpell(projectile.world, projectile.monster, 'ember_dart')).toBe(true);
    expect(projectile.world.spellShots[0]).toMatchObject({ caster: 'monster', damage: 6, element: 'fire' });
    expect(castMonsterSpell(projectile.world, projectile.monster, 'ember_dart')).toBe(false);
    const before = projectile.world.hero.hp;
    run(projectile.world, 0.5);
    expect(projectile.world.hero.hp).toBeLessThan(before);

    const beam = caster('searing_line');
    const initial = beam.world.hero.hp;
    expect(castMonsterSpell(beam.world, beam.monster, 'searing_line')).toBe(true);
    expect(beam.world.hero.hp).toBeLessThan(initial);
    expect(beam.world.spellVisuals.some((fx) => fx.shape === 'beam')).toBe(true);
  });

  it('supports hostile burst and ticking cloud from shared spells.json shapes', () => {
    const burst = caster('pulse_burst', 12, 10);
    const hp = burst.world.hero.hp;
    expect(castMonsterSpell(burst.world, burst.monster, 'pulse_burst')).toBe(true);
    expect(burst.world.hero.hp).toBeLessThan(hp);

    const cloud = caster('ash_cloud', 13, 10);
    expect(castMonsterSpell(cloud.world, cloud.monster, 'ash_cloud')).toBe(true);
    expect(cloud.world.spellClouds[0]?.caster).toBe('monster');
    const initial = cloud.world.hero.hp;
    run(cloud.world, 0.6);
    expect(cloud.world.hero.hp).toBeLessThan(initial);
  });

  it('uses guard to prevent damage and blink to reposition without a monster-specific effect', () => {
    const guarded = caster('phase_guard');
    guarded.monster.hp -= 3;
    expect(castMonsterSpell(guarded.world, guarded.monster, 'phase_guard')).toBe(true);
    const hp = guarded.monster.hp;
    expect(hurtMonster(guarded.world, guarded.monster, 10).damage).toBe(0);
    expect(guarded.monster.hp).toBe(hp);

    const blinking = caster('blink_step', 11.5, 10);
    const x = blinking.monster.x;
    expect(castMonsterSpell(blinking.world, blinking.monster, 'blink_step')).toBe(true);
    expect(blinking.monster.x).toBeGreaterThan(x);
    expect(blinking.monster.mana).toBeLessThan(40);
  });
});

describe('shared item effects and finite monster inventory', () => {
  it('selects a healing potion at low HP and consumes exactly one use', () => {
    const w = quietArena();
    const baseline = spawnMonster(w, 'goblin', 15, 10, true);
    const monster: Monster = {
      ...baseline,
      hp: 3,
      rest: 0,
      stats: { ...baseline.stats, windup: 0.05 },
      itemUses: { potion_healing: 1 },
    };
    w.monsters[0] = monster;
    expect(selectMonsterAction(monsterContext(w, monster))).toMatchObject({ action: 'item', itemId: 'potion_healing' });
    run(w, 0.18);
    expect(monster.hp).toBe(monster.maxHp);
    expect(monster.itemUses.potion_healing).toBe(0);
    expect(availableMonsterActions(monsterContext(w, monster)).some((a) => a.itemId === 'potion_healing')).toBe(false);
  });

  it('casts an items.json wand against the hero through the same elemental damage resolver', () => {
    const w = quietArena();
    const baseline = spawnMonster(w, 'goblin', 14, 10, true);
    const monster: Monster = {
      ...baseline,
      rest: 0,
      stats: { ...baseline.stats, windup: 0.05 },
      itemUses: { wand_sparks: 1 },
    };
    w.monsters[0] = monster;
    const before = w.hero.hp;
    expect(selectMonsterAction(monsterContext(w, monster))).toMatchObject({ action: 'item', itemId: 'wand_sparks' });
    run(w, 0.18);
    expect(w.hero.hp).toBeLessThan(before);
    expect(monster.itemUses.wand_sparks).toBe(0);
    expect(itemDefinition('wand_sparks').effects[0]?.power).toBe(8);
  });

  it('uses the same blink item rules for both actors and respects monster collision', () => {
    const w = quietArena();
    const monster = spawnMonster(w, 'goblin', 11.5, 10, true);
    const old = monster.x;
    expect(activateItem(w, 'scroll_blink', 'monster', monster)).toBe(true);
    expect(monster.x).toBeGreaterThan(old);
    expect(Math.hypot(monster.x - w.hero.x, monster.y - w.hero.y)).toBeGreaterThan(w.heroDef.radius + monster.stats.radius);
  });

  it('holds spellcasting distance during cooldown rather than walking into melee', () => {
    const { monster, world } = caster('ember_dart');
    monster.spellCooldown = 2;
    const context = monsterContext(world, monster);
    expect(context.effectiveRange).toBe(6);
    expect(selectMonsterAction(context).action).toBe('hold');
  });
});
