import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { plainWeapon } from '../../src/data/items';
import { spellData } from '../../src/data/spells';
import { DUNGEON } from '../../src/data/packs';
import { heroResists } from '../../src/sim/effects';
import { heroSpeed, gainExperience, xpToNext } from '../../src/sim/skills';
import { slotBonus, slotData, upgradeSlot, type SlotId } from '../../src/sim/slots';
import { spellDamage } from '../../src/sim/spells';
import { makeWorld } from '../../src/sim/world';

function grant(w: ReturnType<typeof makeWorld>, id: SlotId, resist?: 'fire' | 'cold' | 'electric' | 'poison' | 'negative'): boolean {
  w.pendingRewards.push('slot');
  return upgradeSlot(w, id, resist);
}

describe('level cap and ordered reward schedule', () => {
  // Slot enhancement is switched off in the data for now; these check the path for when it is on.
  const rewards = DUNGEON.levelRewards as { slot: boolean };
  beforeEach(() => {
    rewards.slot = true;
  });
  afterEach(() => {
    rewards.slot = false;
  });

  it('queues only acquirement while slot enhancement is switched off', () => {
    rewards.slot = false;
    const w = makeWorld({ monsters: false, items: false });
    for (let level = 1; level < 9; level++) gainExperience(w, xpToNext(w.hero.level));
    expect(w.hero.level).toBe(9);
    expect(w.pendingRewards).toEqual(['acquire']);
  });

  it('stops at level 27 and no longer stores character XP', () => {
    const w = makeWorld({ monsters: false, items: false });
    const throughCap = Array.from({ length: DUNGEON.levelCap - 1 }, (_, i) => xpToNext(i + 1)).reduce((a, b) => a + b, 0);
    gainExperience(w, throughCap + 10_000);
    expect(w.hero.level).toBe(27);
    expect(w.hero.xp).toBe(0);
    gainExperience(w, 10_000);
    expect(w.hero.level).toBe(27);
    expect(w.hero.xp).toBe(0);
  });

  it('queues one slot per level and acquirement immediately after levels 9, 18 and 27', () => {
    const w = makeWorld({ monsters: false, items: false });
    const throughCap = Array.from({ length: 26 }, (_, i) => xpToNext(i + 1)).reduce((a, b) => a + b, 0);
    gainExperience(w, throughCap);
    const expected: ('slot' | 'acquire')[] = [];
    for (let level = 2; level <= 27; level++) {
      expected.push('slot');
      if ([9, 18, 27].includes(level)) expected.push('acquire');
    }
    expect(w.pendingRewards).toEqual(expected);
  });
});

describe('permanent slot enhancement state', () => {
  it('applies boots with no boots equipped and survives equipment changes', () => {
    const w = makeWorld({ monsters: false, items: false });
    delete w.gear.boots;
    const base = heroSpeed(w);
    expect(grant(w, 'boots')).toBe(true);
    expect(heroSpeed(w)).toBeCloseTo(base * 1.03);
    w.gear.boots = 'boots';
    delete w.gear.boots;
    expect(w.hero.slotLevels.boots).toBe(1);
    expect(heroSpeed(w)).toBeCloseTo(base * 1.03);
  });

  it('does not consume the queue when a slot is capped', () => {
    const w = makeWorld({ monsters: false, items: false });
    for (let i = 0; i < slotData('cloak').cap; i++) expect(grant(w, 'cloak')).toBe(true);
    w.pendingRewards.push('slot');
    expect(upgradeSlot(w, 'cloak')).toBe(false);
    expect(w.pendingRewards).toEqual(['slot']);
  });

  it('requires a first ring resistance and keeps each ring choice separate', () => {
    const w = makeWorld({ monsters: false, items: false });
    w.pendingRewards.push('slot');
    expect(upgradeSlot(w, 'ring1')).toBe(false);
    expect(w.pendingRewards).toEqual(['slot']);
    expect(upgradeSlot(w, 'ring1', 'fire')).toBe(true);
    expect(grant(w, 'ring2', 'cold')).toBe(true);
    expect(w.hero.ringResist).toEqual({ ring1: 'fire', ring2: 'cold' });
  });

  it('raises both current and maximum HP and MP immediately', () => {
    const w = makeWorld({ monsters: false, items: false });
    const hp = [w.hero.hp, w.hero.maxHp];
    const mana = [w.hero.mana, w.hero.maxMana];
    grant(w, 'helmet');
    grant(w, 'amulet');
    expect([w.hero.hp, w.hero.maxHp]).toEqual(hp.map((value) => value + 4));
    expect([w.hero.mana, w.hero.maxMana]).toEqual(mana.map((value) => value + 2));
  });
});

describe('each slot effect', () => {
  it('provides physical damage, AC, block, attack speed, movement, dodge and resistance values', () => {
    const w = makeWorld({ monsters: false, items: false });
    for (const id of ['weapon', 'body', 'offhand', 'gloves', 'boots', 'cloak'] as const) grant(w, id);
    grant(w, 'ring1', 'poison');
    expect(slotBonus(w, 'weapon_damage')).toBe(1);
    expect(slotBonus(w, 'armour')).toBe(1);
    expect(slotBonus(w, 'block')).toBeCloseTo(0.02);
    expect(slotBonus(w, 'attack_speed')).toBeCloseTo(0.03);
    expect(slotBonus(w, 'move_speed')).toBeCloseTo(0.03);
    expect(slotBonus(w, 'dodge')).toBeCloseTo(0.02);
    expect(heroResists(w).poison).toBe((w.heroDef.resists.poison ?? 0) + 1);
  });

  it('adds weapon magic power only to its school and spellbook power only to the book school', () => {
    const w = makeWorld({ monsters: false, items: false, species: 'deep_elf', job: 'air_mage' });
    w.weapon = plainWeapon('staff_fire_0', 'fire-staff');
    grant(w, 'weapon');
    const fire = spellData('ember_dart');
    const ice = spellData('frost_needle');
    expect(spellDamage(w, fire)).toBe(fire.damage! + slotBonus(w, 'magic_power', 'fire'));
    expect(slotBonus(w, 'magic_power', 'fire')).toBe(1);
    expect(slotBonus(w, 'magic_power', 'ice')).toBe(0);
    w.weapon = plainWeapon('long_sword', 'sword');
    w.gear.offhand = 'spellbook_ice_0';
    grant(w, 'offhand');
    expect(slotBonus(w, 'magic_power', 'ice')).toBe(1);
    expect(slotBonus(w, 'magic_power', 'fire')).toBe(0);
    expect(spellDamage(w, ice)).toBe(ice.damage! + 1);
  });
});
