import type { WeaponItem } from '../data/items';
import { hasTile, TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import type { World } from '../sim/world';
import type { Sheet } from './atlas';
import type { WalkCut } from './walk';

/** Where a DCSS player doll is cut to make it step: its legs start about two thirds down. */
export const DOLL_CUT: WalkCut = { legs: 22, mid: 16 };

const BASE: Readonly<Record<string, string>> = {
  minotaur: 'player/base/minotaur_m',
  barachi: 'player/base/frog_m',
  deep_elf: 'player/base/deep_elf_m',
};
const HAIR: Readonly<Record<string, string>> = { deep_elf: 'player/hair/elf_black' };

/** What each job wears when no body armour is on, as DCSS dresses its starting characters. */
const OUTFIT: Readonly<Record<string, string>> = {
  berserker: 'player/body/animal_skin',
  hunter: 'player/body/leather_jacket',
  spellblade: 'player/body/leather_red',
  fire_mage: 'player/body/robe_red',
  ice_mage: 'player/body/robe_blue',
  air_mage: 'player/body/robe_clouds',
  earth_mage: 'player/body/robe_brown',
  summoner: 'player/body/robe_green',
  hexer: 'player/body/robe_purple',
  necromancer: 'player/body/robe_black',
};

const WORN: Readonly<Record<string, string>> = {
  animal_skin: 'player/body/animal_skin',
  leather_armour: 'player/body/leather_armour',
  chain_mail: 'player/body/chainmail',
  helmet_iron: 'player/head/iron1',
  cloak_wool: 'player/cloak/gray',
  gloves_leather: 'player/gloves/glove_brown',
  boots_leather: 'player/boots/short_brown',
  buckler: 'player/hand2/buckler_round',
  kite_shield: 'player/hand2/kite_shield_kite1',
};

const WIELDED: Readonly<Record<string, string>> = {
  hand_axe: 'player/hand1/hand_axe',
  war_axe: 'player/hand1/war_axe',
  battle_axe: 'player/hand1/battleaxe',
  long_sword: 'player/hand1/long_sword_slant',
  great_sword: 'player/hand1/great_sword',
  shortbow: 'player/hand1/shortbow',
  longbow: 'player/hand1/bow',
  orcbow: 'player/hand1/orcbow1',
  ember: 'player/hand1/war_axe',
  glut: 'player/hand1/axe_executioner',
  piercer: 'player/hand1/bow',
  moonblade: 'player/hand1/great_sword',
};

/** Just what the doll needs to know about a weapon, from a wielded item or a catalogue entry. */
export type Wieldable = Pick<WeaponItem, 'family'> & { readonly kind?: string; readonly baseId?: string; readonly id?: string };

function wielded(weapon: Wieldable): string | undefined {
  if (weapon.kind === 'staff') return 'player/hand1/staff_mage';
  if (weapon.kind === 'rod') return 'player/hand1/staff_fork';
  if (weapon.kind === 'wand') return undefined;
  return (
    WIELDED[weapon.baseId ?? weapon.id ?? ''] ??
    (weapon.family === 'axe' ? 'player/hand1/war_axe' : weapon.family === 'ranged' ? 'player/hand1/bow' : 'player/hand1/long_sword_slant')
  );
}

/**
 * The layers of the hero's doll, bottom to top in DCSS order: cloak, body, boots, armour, gloves,
 * weapon, off-hand, hair, helmet. Every tile named here exists in the sheet; missing ones are skipped.
 */
export function dollLayers(w: World): TileName[] {
  return layersFor(w.heroDef.species, w.heroDef.job, w.gear, w.weapon);
}

/** The same layers for a hero not yet in a run (the choosing screen): species, job outfit, weapon. */
export function layersFor(
  species: string,
  job: string | undefined,
  gear: Readonly<Partial<Record<string, string>>> = {},
  weapon?: Wieldable,
): TileName[] {
  const offhand = gear.offhand;
  const layers = [
    gear.cloak ? WORN[gear.cloak] : undefined,
    BASE[species],
    gear.boots ? WORN[gear.boots] : undefined,
    (gear.armour && gear.armour !== 'robe' && WORN[gear.armour]) ||
      (job ? OUTFIT[job] : undefined) ||
      (gear.armour === 'robe' ? 'player/body/robe_brown' : undefined),
    gear.gloves ? WORN[gear.gloves] : undefined,
    weapon ? wielded(weapon) : undefined,
    offhand ? (WORN[offhand] ?? (offhand.startsWith('spellbook') ? 'player/hand2/orb1' : undefined)) : undefined,
    gear.helmet ? undefined : HAIR[species],
    gear.helmet ? WORN[gear.helmet] : undefined,
  ];
  return layers.filter((name): name is string => Boolean(name) && hasTile(name!)) as TileName[];
}

/** Paints the layers into one 32x32 tile. */
export function composeDoll(source: Sheet, layers: readonly TileName[]): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const g = c.getContext('2d');
  if (!g) return c;
  g.imageSmoothingEnabled = false;
  for (const name of layers) {
    const at = tileRect(name);
    g.drawImage(source, at.x, at.y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  }
  return c;
}
