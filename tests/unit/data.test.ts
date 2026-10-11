import { describe, expect, it } from 'vitest';
import { heroFor } from '../../src/data/hero';
import { validateData } from '../../src/data/validate';
describe('JSON game data',()=>{ it('has valid references',()=>expect(()=>validateData()).not.toThrow()); it('builds the current character from ids',()=>{const h=heroFor('minotaur','berserker');expect(h.hp).toBe(60);expect(h.axe.damage).toBe(7);expect(h.thrown.damage).toBe(8);}); });
