import characters from './json/characters.json';
import jobs from './json/jobs.json';
import species from './json/species.json';
import { characterData } from './characters';
import { heroFor } from './hero';
import { ARTEFACTS, AXES, BRANDS, EQUIPMENT, RANDART_OPTIONS } from './items';
import { MONSTERS } from './monsters';
import { PACKS } from './packs';
import { SKILLS } from './skills';

export function validateData(): void {
  if (!MONSTERS.length) throw new Error('monsters.json: 비어 있음');
  if (!PACKS.length) throw new Error('packs.json: 비어 있음');
  if (!SKILLS.length) throw new Error('skills.json: 비어 있음');
  if (!AXES.length || !BRANDS.length || !RANDART_OPTIONS.length || !ARTEFACTS.length) {
    throw new Error('items.json: 장비 자료가 비어 있음');
  }
  if (EQUIPMENT.ammoStart > EQUIPMENT.ammoMax) throw new Error('items.json: 시작 탄약이 최대 탄약보다 큼');
  for (const row of species) {
    for (const aptitude of Object.values(row.aptitudes)) {
      if (!['good', 'normal', 'bad'].includes(aptitude)) {
        throw new Error('species.json: ' + row.id + ': 잘못된 적성 ' + aptitude);
      }
    }
  }
  for (const character of characters) {
    characterData(character.id);
    heroFor(character.species, character.job);
  }
  for (const s of species) {
    for (const j of jobs) {
      if (characters.some((character) => character.species === s.id && character.job === j.id)) {
        heroFor(s.id, j.id);
      }
    }
  }
}
