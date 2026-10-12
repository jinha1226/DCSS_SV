import characters from './json/characters.json';
import jobs from './json/jobs.json';
import species from './json/species.json';
import { characterData } from './characters';
import { ITEM_DEFINITIONS, validateItemDefinitions } from './itemCatalog';
import { heroFor } from './hero';
import { ARTEFACTS, AXES, RANGED_WEAPONS, BRANDS, EQUIPMENT, RANDART_OPTIONS, WEAPONS } from './items';
import { MONSTERS } from './monsters';
import { PACKS } from './packs';
import { SKILLS, SCHOOL_IDS } from './skills';
import { SPELLS, SPELL_SCHOOLS } from './spells';

export function validateData(): void {
  validateItemDefinitions();
  if (!MONSTERS.length) throw new Error('monsters.json: 비어 있음');
  if (!PACKS.length) throw new Error('packs.json: 비어 있음');
  if (SKILLS.length !== 20 || new Set(SKILLS.map((skill) => skill.id)).size !== 20) {
    throw new Error('skills.json: 정확히 20개의 스킬이 필요함');
  }
  for (const row of species) {
    const keys = Object.keys(row.aptitudes).sort();
    const required = SKILLS.map((skill) => skill.aptitude).sort();
    if (JSON.stringify(keys) !== JSON.stringify(required)) throw new Error('species.json: 적성 키 누락 ' + row.id);
  }
  for (const item of ITEM_DEFINITIONS) {
    if (['staff', 'rod', 'spellbook'].includes(item.kind) && !SCHOOL_IDS.has(item.school ?? '')) {
      throw new Error('items.json: 잘못된 마법 장비 학파 ' + item.id);
    }
  }
  if (!SPELLS.length) throw new Error('spells.json: 비어 있음');
  for (const school of SPELL_SCHOOLS)
    if (!SKILLS.some((skill) => skill.id === school)) throw new Error('spells.json: 없는 학파 스킬 ' + school);
  if (!WEAPONS.length || !AXES.length || !RANGED_WEAPONS.length || !BRANDS.length || !RANDART_OPTIONS.length || !ARTEFACTS.length)
    throw new Error('items.json: 장비 자료가 비어 있음');
  if (EQUIPMENT.weaponsMin > EQUIPMENT.weaponsMax) throw new Error('items.json: 무기 범위가 잘못됨');
  for (const row of species)
    for (const aptitude of Object.values(row.aptitudes))
      if (!['good', 'normal', 'bad'].includes(aptitude)) throw new Error('species.json: ' + row.id + ': 잘못된 적성 ' + aptitude);
  for (const character of characters) {
    characterData(character.id);
    heroFor(character.species, character.job);
  }
  for (const s of species)
    for (const j of jobs) if (characters.some((character) => character.species === s.id && character.job === j.id)) heroFor(s.id, j.id);
}
