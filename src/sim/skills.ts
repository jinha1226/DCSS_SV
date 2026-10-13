import type { Aptitude } from '../data/hero';
import { DUNGEON } from '../data/packs';
import { SKILLS, skillData, type SkillData, type SkillEffect } from '../data/skills';
import { hasShield, offhandSchool } from './gear';
import type { SkillChoice, World } from './types';
import { dealItemRewards } from './rewards';
import { slotBonus } from './slots';

export const MAX_SKILL = 27;
const COMMON = ['fighting', 'armour', 'dodging', 'stealth', 'spellcasting', 'throwing'] as const;
const APTITUDE_RATE: Readonly<Record<Aptitude, number>> = { good: 1.5, normal: 1, bad: 0.6 };

export function skillLevel(w: World, id: string): number {
  return w.hero.skills[id] ?? 0;
}

export function aptitude(w: World, id: string): Aptitude {
  const skill = skillData(id);
  return w.heroDef.aptitudes[skill.aptitude] ?? 'normal';
}

/** All species share the same cap; aptitude changes training speed, not the limit. */
export const skillCap: (world: World, id: string) => number = () => MAX_SKILL;

function owner(effect: string): { skill: string; rule: SkillEffect } | undefined {
  for (const skill of SKILLS) {
    const rule = skill.effects.find((entry) => entry.effect === effect);
    if (rule) return { skill: skill.id, rule };
  }
  return undefined;
}

export function effectValue(w: World, effect: string): number {
  const found = owner(effect);
  if (!found) return 0;
  if (found.skill === 'shield' && !hasShield(w)) return 0;
  const level = skillLevel(w, found.skill);
  if (found.rule.perLevel !== undefined) {
    return found.rule.level === undefined || level >= found.rule.level ? found.rule.perLevel * level : 0;
  }
  if (found.rule.level !== undefined && level >= found.rule.level) return found.rule.value ?? 1;
  return 0;
}

export const hasEffect = (w: World, effect: string): boolean => effectValue(w, effect) !== 0;

export function xpToNext(level: number): number {
  return DUNGEON.levelXpBase + DUNGEON.levelXpStep * (level - 1);
}

export function openSkill(w: World, id: string, guaranteed = true): void {
  skillData(id);
  if (w.openSkills.has(id)) return;
  w.openSkills.add(id);
  if (guaranteed) w.guaranteedSkills.push(id);
}

export function openStartingSkills(w: World): void {
  for (const [id, level] of Object.entries(w.heroDef.startingSkills)) {
    openSkill(w, id, false);
    w.hero.skills[id] = level;
  }
  openSkill(w, w.weapon.school ?? w.weapon.family, false);
  const secondary = offhandSchool(w);
  if (secondary) openSkill(w, secondary, false);
}

/** Skills grow only from earned XP, not by waiting, moving, or getting hit. */
export function skillXpToNext(level: number): number {
  return 6 + 4 * Math.max(0, level);
}

export function activeTraining(w: World): string[] {
  const active: string[] = [...COMMON];
  if (hasShield(w)) active.push('shield');
  const main = w.weapon.school ?? w.weapon.family;
  active.push(main);
  const secondary = offhandSchool(w);
  if (secondary) active.push(secondary);
  return [...new Set(active)];
}

function earnSkillXp(w: World, id: string, amount: number): void {
  if (amount <= 0) return;
  const rate = APTITUDE_RATE[aptitude(w, id)];
  let level = skillLevel(w, id);
  const before = level;
  let progress = (w.hero.skillXp[id] ?? 0) + amount * rate;
  openSkill(w, id, false);
  while (level < skillCap(w, id) && progress >= skillXpToNext(level)) {
    progress -= skillXpToNext(level);
    level++;
    if (id === 'fighting') {
      w.hero.maxHp += 3;
      w.hero.hp = Math.min(w.hero.maxHp, w.hero.hp + 3);
    }
    if (id === 'spellcasting' && level % 2 === 0) {
      w.hero.maxMana++;
      w.hero.mana = Math.min(w.hero.maxMana, w.hero.mana + 1);
    }
  }
  w.hero.skills[id] = level;
  w.hero.skillXp[id] = level >= MAX_SKILL ? 0 : progress;
  if (level > before) w.events.push({ type: 'skill', id, from: before, level });
}

export function trainSkills(w: World, amount: number): void {
  if (amount <= 0) return;
  for (const id of COMMON) earnSkillXp(w, id, amount);
  if (hasShield(w)) earnSkillXp(w, 'shield', amount);
  const main = w.weapon.school ?? w.weapon.family;
  const secondary = offhandSchool(w);
  if (!secondary || main === secondary) earnSkillXp(w, main, amount);
  else {
    earnSkillXp(w, main, amount / 2);
    earnSkillXp(w, secondary, amount / 2);
  }
}

function allowed(w: World, skill: SkillData): boolean {
  if (skill.id === 'shield' && !hasShield(w)) return false;
  return skillLevel(w, skill.id) < skillCap(w, skill.id);
}

function gainFor(w: World, id: string): number {
  if (aptitude(w, id) === 'good' && w.rng() < 0.5) return 2;
  return 1;
}

export function makeSkillChoice(w: World, id: string): SkillChoice {
  const skill = skillData(id);
  const from = skillLevel(w, id);
  const cap = skillCap(w, id);
  const gain = Math.min(gainFor(w, id), cap - from);
  const to = from + Math.max(0, gain);
  const milestone = skill.effects.find((effect) => effect.level === to && effect.text)?.text;
  return {
    id,
    name: skill.name,
    from,
    to,
    gain: to - from,
    cap,
    line: milestone ?? skill.each,
  };
}

function weightedPick(w: World, source: readonly SkillData[]): SkillData {
  const weighted = source.map((skill) => ({
    skill,
    weight: aptitude(w, skill.id) === 'good' ? 1.5 : aptitude(w, skill.id) === 'bad' ? 0.5 : 1,
  }));
  let roll = w.rng() * weighted.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.skill;
  }
  return weighted[weighted.length - 1]!.skill;
}

function candidates(w: World): SkillData[] {
  return SKILLS.filter((skill) => allowed(w, skill));
}

function dealLegacySkillChoice(w: World): void {
  if (w.choosing) return;
  const pool = candidates(w);
  const picked: SkillData[] = [];
  while (picked.length < 3 && pool.length) {
    const chosen = weightedPick(w, pool);
    picked.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }
  w.choosing = picked.length ? picked.map((skill) => makeSkillChoice(w, skill.id)) : null;
}

export function gainExperience(w: World, amount: number): void {
  if (amount <= 0) return;
  if (w.hero.level < DUNGEON.levelCap) w.hero.xp += amount;
  while (w.hero.level < DUNGEON.levelCap && w.hero.xp >= xpToNext(w.hero.level)) {
    w.hero.xp -= xpToNext(w.hero.level);
    w.hero.level++;
    // Slot enhancement on every level is switched off for now (levelRewards.slot in dungeon.json).
    if (DUNGEON.levelRewards.slot) w.pendingRewards.push('slot');
    if (DUNGEON.levelRewards.acquire.includes(w.hero.level)) w.pendingRewards.push('acquire');
  }
  if (w.hero.level >= DUNGEON.levelCap) w.hero.xp = 0;
  trainSkills(w, amount);
  dealItemRewards(w);
}

export function chooseSkill(w: World, id: string): void {
  const choice = w.choosing?.find((card) => card.id === id);
  if (!choice || w.rewardChoices) return;
  const before = skillLevel(w, id);
  const gained = choice.to - before;
  w.hero.skills[id] = choice.to;
  if (id === 'fighting' && gained > 0) {
    const hp = 3 * gained;
    w.hero.maxHp += hp;
    w.hero.hp += hp;
  }
  if (gained > 0) w.events.push({ type: 'skill', id, from: before, level: choice.to });
  w.choosing = null;
}

export function heroSpeed(w: World): number {
  return (
    w.speed *
    (1 +
      effectValue(w, 'dodging.speed') +
      (w.weapon.options.find((option) => option.id === 'speed')?.value ?? 0) +
      slotBonus(w, 'move_speed')) *
    (w.hero.haste > 0 ? 1.3 : 1) *
    (1 + (w.hero.speedBuff > 0 ? w.hero.speedBuffPower : 0))
  );
}

export function heroGive(w: World): number {
  if (hasEffect(w, 'armour.unmoved')) return 0;
  return w.heroDef.give * (hasEffect(w, 'dodging.squeeze') ? effectValue(w, 'dodging.squeeze') : 1);
}

export function throwCooldown(w: World): number {
  return Math.max(0.25, w.heroDef.thrown.every + effectValue(w, 'throwing.cooldown'));
}

export function dealSkillChoices(w: World): void {
  dealLegacySkillChoice(w);
}
