import { itemDefinition } from '../data/itemCatalog';
import { DUNGEON } from '../data/packs';
import { SPELLS, type SpellData } from '../data/spells';
import { skillLevel } from './skills';
import type { World } from './types';

/** Phones show this many spell buttons; the rest of the equipped spells wait in the status sheet. */
export const SPELL_SLOTS = 4;

/** Levels 1 and 2 need no school skill, so a new school's first auto attack and first button work at once. */
export function requiredLevel(spell: SpellData): number {
  return spell.requirement ?? Math.max(0, DUNGEON.spellRequirementStep * (spell.level - 2));
}

function unlocked(w: World, spell: SpellData): boolean {
  return skillLevel(w, spell.school) >= requiredLevel(spell);
}

interface MagicSource {
  readonly school: string;
  readonly tier: number;
}

function sources(w: World): MagicSource[] {
  const found: MagicSource[] = [];
  if (w.weapon.kind === 'staff') found.push({ school: w.weapon.school!, tier: w.weapon.tier! });
  if (w.gear.offhand) {
    const item = itemDefinition(w.gear.offhand);
    if (item.kind === 'spellbook') found.push({ school: item.school!, tier: item.tier! });
  }
  return found;
}

function withinTier(spell: SpellData, source: MagicSource): boolean {
  return source.school === spell.school && spell.level <= DUNGEON.magicTierMaxLevel[source.tier]!;
}

/** Button spells the equipped staff and spellbook give, locked or not. Rods give none. */
function equippedButtonSpells(w: World): SpellData[] {
  const found = sources(w);
  return SPELLS.filter((spell) => spell.enabled && !spell.auto && found.some((source) => withinTier(spell, source)));
}

export function knownSpells(w: World, school?: string): SpellData[] {
  return equippedButtonSpells(w).filter((spell) => (!school || spell.school === school) && unlocked(w, spell));
}

export function lockedSpells(w: World): SpellData[] {
  return equippedButtonSpells(w).filter((spell) => !unlocked(w, spell));
}

export function paidSpells(w: World): SpellData[] {
  return knownSpells(w);
}

/** A staff or rod fires the highest unlocked automatic spell of its school and tier. */
export function basicSpell(w: World): SpellData | undefined {
  if (w.weapon.kind !== 'staff' && w.weapon.kind !== 'rod') return undefined;
  const source: MagicSource = { school: w.weapon.school!, tier: w.weapon.tier! };
  return SPELLS.filter((spell) => spell.enabled && spell.auto && withinTier(spell, source) && unlocked(w, spell)).sort(
    (a, b) => b.level - a.level,
  )[0];
}

function autoFillOrder(w: World, spells: readonly SpellData[]): SpellData[] {
  const open = spells.filter((spell) => unlocked(w, spell)).sort((a, b) => b.level - a.level);
  const closed = spells.filter((spell) => !unlocked(w, spell)).sort((a, b) => a.level - b.level);
  return [...open, ...closed];
}

/**
 * The four button slots. Spells the player pinned keep their slot while still equipped;
 * empty slots take the highest unlocked spells, then the nearest locked ones.
 */
export function spellSlots(w: World): (SpellData | undefined)[] {
  const candidates = equippedButtonSpells(w);
  const slots = Array.from({ length: SPELL_SLOTS }, (_, i) => candidates.find((spell) => spell.id === w.hero.spellSlots[i]));
  const taken = new Set(slots.filter((spell) => spell).map((spell) => spell!.id));
  const fill = autoFillOrder(
    w,
    candidates.filter((spell) => !taken.has(spell.id)),
  );
  return slots.map((spell) => spell ?? fill.shift());
}

/** Pins a spell to a slot (or clears the pin). A spell pinned elsewhere moves here. */
export function setSpellSlot(w: World, index: number, spellId: string | undefined): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= SPELL_SLOTS) return false;
  if (spellId !== undefined && !equippedButtonSpells(w).some((spell) => spell.id === spellId)) return false;
  const pins = Array.from({ length: SPELL_SLOTS }, (_, i) => (w.hero.spellSlots[i] === spellId ? undefined : w.hero.spellSlots[i]));
  pins[index] = spellId;
  w.hero.spellSlots = pins;
  return true;
}

export function slottedSpell(w: World, spellId: string): boolean {
  return spellSlots(w).some((spell) => spell?.id === spellId);
}

export function spellCooldownLeft(w: World, spellId: string): number {
  return Math.max(0, w.hero.spellCooldowns[spellId] ?? 0, w.hero.spellCooldown);
}

/** Unlocked, slotted, affordable and off cooldown. */
export function spellReady(w: World, spell: SpellData): boolean {
  return unlocked(w, spell) && slottedSpell(w, spell.id) && w.hero.mana >= spell.mana && spellCooldownLeft(w, spell.id) <= 0;
}

export function tickSpellCooldowns(w: World, dt: number): void {
  const h = w.hero;
  if (h.spellCooldown > 0) h.spellCooldown = Math.max(0, h.spellCooldown - dt);
  if (h.autoCooldown > 0) h.autoCooldown = Math.max(0, h.autoCooldown - dt);
  for (const id of Object.keys(h.spellCooldowns)) {
    const left = h.spellCooldowns[id]! - dt;
    if (left > 0) h.spellCooldowns[id] = left;
    else delete h.spellCooldowns[id];
  }
}
