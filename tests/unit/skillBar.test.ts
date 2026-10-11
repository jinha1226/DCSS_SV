import { describe, expect, it } from 'vitest';
import { displayedEquipment, listedSkills } from '../../src/ui/skillBar';
import { makeWorld } from '../../src/sim/world';

describe('skill summary bar', () => {
  it('shows only trained skills in the compact bar, but opened skills in the details', () => {
    const world = makeWorld({ items: false, monsters: false });
    world.hero.skills.axe = 4;
    const summary = listedSkills(world);
    expect(summary.find((skill) => skill.id === 'axe')?.level).toBe(4);
    expect(summary.some((skill) => skill.level === 0)).toBe(false);
    const details = listedSkills(world, true);
    expect(details.some((skill) => skill.id === 'armour' && skill.level === 0)).toBe(true);
  });

  it('updates immediately when skill levels change and supports new schools automatically', () => {
    const world = makeWorld({ items: false, monsters: false });
    world.openSkills.add('fire');
    world.hero.skills.fire = 2;
    expect(listedSkills(world).find((skill) => skill.id === 'fire')).toMatchObject({ name: '화염술', level: 2 });
    world.hero.skills.fire = 3;
    expect(listedSkills(world).find((skill) => skill.id === 'fire')?.level).toBe(3);
  });
  it('shows the equipped weapon and available throwing ammo without inventing unused slots', () => {
    const world = makeWorld({ items: false, monsters: false });
    const equipment = displayedEquipment(world);
    expect(equipment[0]).toMatchObject({ id: world.weapon.uid, tile: world.weapon.tile });
    if (world.openSkills.has('throwing')) {
      expect(equipment[1]).toMatchObject({ id: 'boomerang', count: world.ammo });
    }
    world.ammo = 2;
    if (world.openSkills.has('throwing')) expect(displayedEquipment(world)[1]?.count).toBe(2);
  });
});
