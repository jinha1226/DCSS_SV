import skillsRaw from './json/skills.json';

export const SKILL_EFFECTS = new Set([
  'axe.damage',
  'mace.damage',
  'polearm.damage',
  'unarmed.damage',
  'axe.wide',
  'axe.spin',
  'axe.stun',
  'axe.reset',
  'ranged.damage',
  'ranged.haste',
  'ranged.range',
  'ranged.pierce',
  'ranged.stun',
  'ranged.double',
  'fighting.hp',
  'fighting.regen',
  'fighting.healKill',
  'fighting.desperate',
  'fighting.lastStand',
  'armour.reduce',
  'armour.stone',
  'armour.deflect',
  'armour.unmoved',
  'armour.thorns',
  'shield.chance',
  'shield.push',
  'shield.missile',
  'shield.stun',
  'shield.reset',
  'dodging.chance',
  'dodging.speed',
  'dodging.delay',
  'dodging.squeeze',
  'dodging.grace',
  'throwing.power',
  'throwing.cooldown',
  'throwing.pierce',
  'throwing.double',
  'throwing.slow',
  'throwing.slowTime',
  'throwing.return',
  'blade.damage',
  'blade.haste',
  'blade.parry',
  'blade.reach',
  'blade.reset',
]);

export interface SkillEffect {
  readonly effect: string;
  readonly level?: number;
  readonly value?: number;
  readonly perLevel?: number;
  readonly text?: string;
}
export interface SkillData {
  readonly id: string;
  readonly name: string;
  readonly each: string;
  readonly aptitude: string;
  readonly effects: readonly SkillEffect[];
}
export const BASIC_SKILLS = ['fighting', 'armour', 'dodging', 'shield', 'stealth', 'spellcasting', 'throwing'] as const;
export const WEAPON_SKILLS = ['blade', 'axe', 'mace', 'polearm', 'unarmed', 'ranged'] as const;
export const SCHOOL_SKILLS = ['fire', 'ice', 'air', 'earth', 'summoning', 'hexes', 'necromancy'] as const;
export const SCHOOL_IDS = new Set<string>(SCHOOL_SKILLS);

export const SKILLS: readonly SkillData[] = skillsRaw.map((row) => {
  const effects: SkillEffect[] = row.effects.map((effect) => {
    const name: string = effect.effect;
    if (!SKILL_EFFECTS.has(name)) throw new Error('skills.json: ' + row.id + ': 코드에 없는 effect ' + name);
    if (!('level' in effect) && !('perLevel' in effect))
      throw new Error('skills.json: ' + row.id + '.' + name + ': level 또는 perLevel이 필요함');
    return {
      effect: name,
      ...('level' in effect ? { level: effect.level } : {}),
      ...('value' in effect ? { value: effect.value } : {}),
      ...('perLevel' in effect ? { perLevel: effect.perLevel } : {}),
      ...('text' in effect ? { text: effect.text } : {}),
    };
  });
  return { id: row.id, name: row.name, each: row.each, aptitude: row.aptitude, effects };
});
export function skillData(id: string): SkillData {
  const found = SKILLS.find((skill) => skill.id === id);
  if (!found) throw new Error('skills.json: ' + id + ': 없는 스킬');
  return found;
}

/** The perks a skill opens on the way from one level to another, in level order. */
export function unlockedPerks(id: string, from: number, to: number): string[] {
  return skillData(id)
    .effects.filter((effect) => effect.level !== undefined && from < effect.level && effect.level <= to && effect.text !== undefined)
    .sort((a, b) => a.level! - b.level!)
    .map((effect) => effect.text!);
}
