import { DUNGEON } from '../data/packs';
import { SKILLS, skillData, type SkillEffect } from '../data/skills';
import type { SkillChoice, World } from './types';

export const MAX_SKILL = 8;
export function skillLevel(w: World, id: string): number { return w.hero.skills[id] ?? 0; }

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
  const level = skillLevel(w, found.skill);
  if (found.rule.perLevel !== undefined) return found.rule.perLevel * level;
  if (found.rule.level !== undefined && level >= found.rule.level) return found.rule.value ?? 1;
  return 0;
}
export const hasEffect = (w: World, effect: string): boolean => effectValue(w, effect) !== 0;
export function xpToNext(level: number): number { return DUNGEON.levelXpBase + DUNGEON.levelXpStep * (level - 1); }

function firstGain(w: World, id: string): number {
  const skill = skillData(id);
  return Math.max(1, w.heroDef.aptitudes[skill.aptitude] ?? 1);
}
export function nextSkillLevel(w: World, id: string): number {
  const current = skillLevel(w, id);
  return Math.min(MAX_SKILL, current + (current === 0 ? firstGain(w, id) : 1));
}
export function makeSkillChoice(w: World, id: string): SkillChoice {
  const skill = skillData(id);
  const from = skillLevel(w, id);
  const to = nextSkillLevel(w, id);
  const milestone = skill.effects.find((effect) => effect.level === to && effect.text)?.text;
  return { id, name: skill.name, from, to, line: milestone ?? skill.each };
}
function deal(w: World): void {
  if (w.pendingChoices <= 0 || w.choosing) return;
  const available = SKILLS.filter((skill) => skillLevel(w, skill.id) < MAX_SKILL);
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(w.rng() * (i + 1));
    const swap = available[i]!;
    available[i] = available[j]!;
    available[j] = swap;
  }
  w.choosing = available.slice(0, 3).map((skill) => makeSkillChoice(w, skill.id));
}
export function gainExperience(w: World, amount: number): void {
  if (amount <= 0) return;
  w.hero.xp += amount;
  while (w.hero.xp >= xpToNext(w.hero.level)) {
    w.hero.xp -= xpToNext(w.hero.level);
    w.hero.level++;
    w.pendingChoices++;
  }
  deal(w);
}
export function chooseSkill(w: World, id: string): void {
  const choice = w.choosing?.find((card) => card.id === id);
  if (!choice) return;
  const before = skillLevel(w, id);
  const gained = choice.to - before;
  w.hero.skills[id] = choice.to;
  if (id === 'fighting' && gained > 0) {
    const hp = 8 * gained;
    w.hero.maxHp += hp;
    w.hero.hp += hp;
  }
  w.pendingChoices = Math.max(0, w.pendingChoices - 1);
  w.choosing = null;
  deal(w);
}
export function heroSpeed(w: World): number { return w.speed * (1 + effectValue(w, 'dodging.speed')); }
export function heroGive(w: World): number {
  if (hasEffect(w, 'armour.unmoved')) return 0;
  return w.heroDef.give * (hasEffect(w, 'dodging.squeeze') ? effectValue(w, 'dodging.squeeze') : 1);
}
export function hornDamage(w: World): number {
  const h = w.heroDef.horns;
  return h.damage + Math.floor(w.hero.level / h.damageEveryLevel) * h.damageGain;
}
export function hornEvery(w: World): number {
  const h = w.heroDef.horns;
  return Math.max(h.minEvery, h.every - Math.floor(w.hero.level / h.speedEveryLevel) * h.speedGain);
}
export function throwCooldown(w: World): number {
  return Math.max(0.25, w.heroDef.thrown.every + effectValue(w, 'throwing.cooldown'));
}
