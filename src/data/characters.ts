import charactersRaw from './json/characters.json';

export interface CharacterData {
  readonly id: string;
  readonly species: string;
  readonly job: string;
  readonly name: string;
  readonly tagline: string;
}

export const CHARACTERS: readonly CharacterData[] = charactersRaw;

export function characterData(id: string): CharacterData {
  const found = CHARACTERS.find((character) => character.id === id);
  if (!found) throw new Error('characters.json: ' + id + ': 없는 캐릭터');
  return found;
}
