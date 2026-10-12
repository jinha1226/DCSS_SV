import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS } from '../../src/data/itemCatalog';
import { SKILLS, SCHOOL_SKILLS } from '../../src/data/skills';
import { plainAxe, plainWeapon } from '../../src/data/items';
import { equipStoredWeapon, generateRandomMagicWeapon } from '../../src/sim/equipment';
import { equipGear, hasShield, offhandSchool } from '../../src/sim/gear';
import { lootTier } from '../../src/sim/lootTier';
import { gainExperience, trainSkills } from '../../src/sim/skills';
import { basicSpell, knownSpells, lockedSpells, paidSpells, requiredLevel } from '../../src/sim/spells';
import { spellData } from '../../src/data/spells';
import { makeWorld } from '../../src/sim/world';

const bare = () => makeWorld({ monsters: false, items: false, seed: 4421 });

describe('equipment-driven training and offhand', () => {
  it('keeps every shared skill training, even without ammunition', () => {
    const w = bare();
    w.ammo = 0;
    trainSkills(w, 5);
    for (const id of ['fighting', 'armour', 'dodging', 'stealth', 'spellcasting', 'throwing', 'axe']) {
      expect(w.hero.skillXp[id]).toBeGreaterThan(0);
    }
    expect(w.hero.skillXp.shield).toBeUndefined();
  });

  it('splits the attack XP between sword and fire book, keeping shared XP full', () => {
    const w = makeWorld({ species: 'barachi', job: 'spellblade', monsters: false, items: false });
    w.gear.offhand = 'spellbook_fire_0';
    const blade = w.hero.skillXp.blade ?? 0;
    trainSkills(w, 2);
    expect(w.hero.skillXp.blade! - blade).toBeCloseTo(1);
    expect(w.hero.skillXp.fire).toBeCloseTo(1);
    expect(w.hero.skillXp.throwing).toBeCloseTo(3);
  });

  it('does not split identical magic schools, and trains staff schools alone', () => {
    const w = makeWorld({ species: 'deep_elf', job: 'conjurer', monsters: false, items: false });
    w.weapon = plainWeapon('rod_fire_0');
    w.gear.offhand = 'spellbook_fire_0';
    trainSkills(w, 3);
    expect(w.hero.skillXp.fire).toBe(4.5);
    expect(offhandSchool(w)).toBe('fire');
    w.weapon = plainWeapon('staff_air_0');
    w.gear.offhand = undefined;
    trainSkills(w, 3);
    expect(w.hero.skillXp.air).toBe(4.5);
    expect(basicSpell(w)?.school).toBe('air');
  });

  it('shield only trains when actually equipped with a one-handed weapon', () => {
    const w = bare();
    w.gear.offhand = 'spellbook_fire_0';
    expect(hasShield(w)).toBe(false);
    trainSkills(w, 5);
    expect(w.hero.skillXp.shield).toBeUndefined();
    w.gear.offhand = 'buckler';
    expect(hasShield(w)).toBe(true);
    trainSkills(w, 5);
    expect(w.hero.skillXp.shield).toBeGreaterThan(0);
  });

  it('stows offhand on equipping a two-handed weapon and blocks re-equipping', () => {
    const w = bare();
    w.gear.offhand = 'buckler';
    w.inventory.push({ uid: 'two', kind: 'weapon', weapon: plainAxe('battle_axe', 'two') });
    expect(equipStoredWeapon(w, 'two')).toBe(true);
    expect(w.gear.offhand).toBeUndefined();
    const returned = w.inventory.find((entry) => entry.kind === 'gear' && entry.id === 'buckler');
    expect(returned).toBeDefined();
    expect(equipGear(w, returned!.uid)).toBe(false);
  });

  it('a spellbook grants blink to a sword, but a rod grants no buttons', () => {
    const w = makeWorld({ species: 'barachi', job: 'spellblade', monsters: false, items: false });
    expect(paidSpells(w).map((spell) => spell.id)).toContain('blink_step');
    w.gear.offhand = 'spellbook_fire_0';
    expect(knownSpells(w).map((spell) => spell.id)).toContain('ember_dart');
    expect(paidSpells(w).map((spell) => spell.id)).not.toContain('blink_step');
    w.gear.offhand = undefined;
    w.weapon = plainWeapon('rod_air_0');
    expect(paidSpells(w)).toEqual([]);
    expect(basicSpell(w)?.id).toBe('arc_needle');
  });

  it('magical and species data enumerate the required schools and skills', () => {
    expect(SKILLS).toHaveLength(20);
    for (const entry of ITEM_DEFINITIONS.filter((item) => ['staff', 'rod', 'spellbook'].includes(item.kind))) {
      expect(SCHOOL_SKILLS).toContain(entry.school);
      expect(entry.tier).toBeGreaterThanOrEqual(0);
    }
    expect(requiredLevel(spellData('blink_step'))).toBe(0);
    const w = makeWorld({ species: 'barachi', job: 'spellblade', monsters: false, items: false });
    expect(lockedSpells(w).map((spell) => spell.id)).toContain('phase_guard');
  });

  it('difficulty rather than graph storage ID sets tier on named branch nodes', () => {
    const w = bare();
    w.depth = [...w.dungeonGraph.nodes.values()].find((node) => node.difficulty >= 11)!.id;
    expect(lootTier(w)).toBe(2);
  });

  it('floor loot can produce both types of non-randart magic main-hand weapons', () => {
    const w = bare();
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      const item = generateRandomMagicWeapon(w);
      seen.add(item.kind!);
      expect(item.special).toBe(false);
      expect(item.school).toBeDefined();
    }
    expect(seen).toEqual(new Set(['staff', 'rod']));
  });

  it('matching seed and choice produces matching cards and training', () => {
    const a = bare(),
      b = bare();
    gainExperience(a, 12);
    gainExperience(b, 12);
    expect(a.rewardChoices).toEqual(b.rewardChoices);
    expect(a.hero.skillXp).toEqual(b.hero.skillXp);
  });
});
