import jobs from './json/jobs.json';
import species from './json/species.json';
import { heroFor } from './hero';
import { ITEMS } from './items';
import { MONSTERS } from './monsters';
import { PACKS } from './packs';
import { SKILLS } from './skills';
export function validateData():void { if(!MONSTERS.length) throw new Error('monsters.json: 비어 있음'); if(!PACKS.length) throw new Error('packs.json: 비어 있음'); if(!SKILLS.length) throw new Error('skills.json: 비어 있음'); if(!ITEMS.length) throw new Error('items.json: 비어 있음'); for(const s of species) for(const j of jobs) heroFor(s.id,j.id); }
