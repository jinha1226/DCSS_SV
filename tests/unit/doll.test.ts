import { describe, expect, it } from 'vitest';
import { hasTile } from '../../src/data/tiles';
import { makeWorld } from '../../src/sim/world';
import { dollLayers, layersFor } from '../../src/view/doll';

describe('the hero doll', () => {
  it('stacks species, job outfit and weapon in DCSS order, every layer a real tile', () => {
    const w = makeWorld({ species: 'minotaur', job: 'berserker', seed: 1, speed: 6.5, depth: 1 });
    const layers = dollLayers(w);
    expect(layers[0]).toBe('player/base/minotaur_m');
    expect(layers).toContain('player/body/animal_skin');
    expect(layers.some((l) => l.startsWith('player/hand1/'))).toBe(true);
    for (const l of layers) expect(hasTile(l)).toBe(true);
  });

  it('wears body armour over the job outfit and hides hair under a helmet', () => {
    const plain = layersFor('deep_elf', 'fire_mage');
    expect(plain).toContain('player/body/robe_red');
    expect(plain).toContain('player/hair/elf_black');
    const armoured = layersFor('deep_elf', 'fire_mage', { armour: 'chain_mail', helmet: 'helmet_iron', cloak: 'cloak_wool' });
    expect(armoured).toContain('player/body/chainmail');
    expect(armoured).not.toContain('player/body/robe_red');
    expect(armoured).not.toContain('player/hair/elf_black');
    expect(armoured[0]).toBe('player/cloak/gray');
    expect(armoured.at(-1)).toBe('player/head/iron1');
  });
});
