import { itemDefinition } from '../data/itemCatalog';
import { identifyItem } from './identification';
import { enchantArmour } from './gear';
import { hurtHero } from './effects';
import { updateFlow } from './flow';
import { computeFov } from './fov';
import { walkable } from './grid';
import { hurtMonster } from './hits';
import type { Monster, World } from './types';

export type ItemUser = 'hero' | 'monster';
export const LIGHTNING_RANGE = 7;

/** Shared JSON-powered effect execution. Inventory and decision logic are separate. */
export function activateItem(w: World, id: string, side: ItemUser, source?: Monster): boolean {
  const item = itemDefinition(id);
  const effect = item.effects[0];
  if (!item.enabled || !effect) return false;
  const actor = side === 'hero' ? w.hero : source;
  if (!actor) return false;
  const power = effect.power ?? 0;

  if (effect.id === 'restore_mana') {
    if (actor.mana >= actor.maxMana) return false;
    actor.mana = Math.min(actor.maxMana, actor.mana + power);
    return true;
  }
  if (effect.id === 'might' && side === 'hero') {
    w.hero.might = Math.max(w.hero.might, power);
    return true;
  }
  if (effect.id === 'haste' && side === 'hero') {
    w.hero.haste = Math.max(w.hero.haste, power);
    return true;
  }
  if (effect.id === 'cure' && side === 'hero') {
    if (w.hero.poison <= 0) return false;
    w.hero.poison = 0;
    return true;
  }
  if (effect.id === 'poison' && side === 'hero') {
    w.hero.poison = Math.max(w.hero.poison, power);
    return true;
  }
  if (effect.id === 'enchant_weapon' && side === 'hero') {
    if (w.weapon.special || (w.weapon.enchantment ?? 0) >= 9) return false;
    w.weapon = { ...w.weapon, enchantment: (w.weapon.enchantment ?? 0) + power };
    return true;
  }
  if (effect.id === 'enchant_armour' && side === 'hero') {
    const target = Object.values(w.gear).find((gearId) => gearId && ['armour', 'shield'].includes(itemDefinition(gearId).kind) && (w.gearEnchantment[gearId] ?? 0) < 9);
    return target ? enchantArmour(w, target) : false;
  }
  if (effect.id === 'remove_curse' && side === 'hero') {
    if (w.cursedGear.size === 0) return false;
    w.cursedGear.clear();
    return true;
  }
  if (effect.id === 'confusion' && side === 'hero') {
    let affected = false;
    for (const monster of w.monsters) {
      if (monster.hp <= 0 || Math.hypot(monster.x - actor.x, monster.y - actor.y) > power) continue;
      monster.confusion = Math.max(monster.confusion, 3);
      affected = true;
    }
    return affected;
  }
  if (effect.id === 'identify' && side === 'hero') {
    const unknown = w.inventory.find((entry) => entry.kind === 'consumable' && !w.identifiedItems.has(entry.id) && entry.id !== id);
    if (!unknown || unknown.kind !== 'consumable') return false;
    identifyItem(w, unknown.id);
    return true;
  }
  if (effect.id === 'fear' && side === 'hero') {
    let affected = false;
    for (const monster of w.monsters) {
      if (monster.hp <= 0 || Math.hypot(monster.x - actor.x, monster.y - actor.y) > power) continue;
      monster.fear = Math.max(monster.fear, 3);
      affected = true;
    }
    return affected;
  }
  if (effect.id === 'teleport' && side === 'hero') {
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < w.grid.h; y++)
      for (let x = 0; x < w.grid.w; x++) {
        if (!walkable(w.grid, x, y) || Math.hypot(x + 0.5 - actor.x, y + 0.5 - actor.y) < power / 2) continue;
        if (w.monsters.some((m) => m.hp > 0 && Math.hypot(m.x - x - 0.5, m.y - y - 0.5) < 1)) continue;
        cells.push({ x: x + 0.5, y: y + 0.5 });
      }
    if (!cells.length) return false;
    const dest = cells[Math.floor(w.rng() * cells.length)]!;
    actor.x = actor.px = dest.x;
    actor.y = actor.py = dest.y;
    computeFov(w.grid, Math.floor(dest.x), Math.floor(dest.y), w.heroDef.sight, w.visible);
    for (let i = 0; i < w.visible.length; i++) if (w.visible[i]) w.seen[i] = 1;
    updateFlow(w.flow, w.grid, Math.floor(dest.x), Math.floor(dest.y));
    return true;
  }
  if (effect.id === 'heal') {
    if (actor.hp >= actor.maxHp) return false;
    actor.hp = Math.min(actor.maxHp, actor.hp + power);
    return true;
  }
  if (effect.id === 'blink') {
    // Both sides use the same destination validity rules. The hero retains
    // random selection; hostile AI chooses the safest (farthest) destination.
    const candidates: { x: number; y: number }[] = [];
    for (let dy = -power; dy <= power; dy++) {
      for (let dx = -power; dx <= power; dx++) {
        const x = Math.floor(actor.x) + dx;
        const y = Math.floor(actor.y) + dy;
        if ((dx === 0 && dy === 0) || !walkable(w.grid, x, y)) continue;
        if (side === 'hero' && !w.visible[y * w.grid.w + x]) continue;
        const cx = x + 0.5;
        const cy = y + 0.5;
        if (side === 'hero') {
          if (w.monsters.some((monster) => monster.hp > 0 && Math.hypot(monster.x - cx, monster.y - cy) < 0.9)) continue;
        } else {
          if (Math.hypot(w.hero.x - cx, w.hero.y - cy) < w.heroDef.radius + source!.stats.radius) continue;
          if (
            w.monsters.some(
              (monster) =>
                monster !== source &&
                monster.hp > 0 &&
                Math.hypot(monster.x - cx, monster.y - cy) < monster.stats.radius + source!.stats.radius,
            )
          )
            continue;
        }
        candidates.push({ x: cx, y: cy });
      }
    }
    if (!candidates.length) return false;
    const destination =
      side === 'hero'
        ? candidates[Math.floor(w.rng() * candidates.length)]!
        : candidates.sort((a, b) => Math.hypot(b.x - w.hero.x, b.y - w.hero.y) - Math.hypot(a.x - w.hero.x, a.y - w.hero.y))[0]!;
    actor.x = actor.px = destination.x;
    actor.y = actor.py = destination.y;
    if (side === 'hero') {
      computeFov(w.grid, Math.floor(destination.x), Math.floor(destination.y), w.heroDef.sight, w.visible);
      for (let i = 0; i < w.visible.length; i++) if (w.visible[i]) w.seen[i] = 1;
      updateFlow(w.flow, w.grid, Math.floor(destination.x), Math.floor(destination.y));
    }
    return true;
  }
  if (effect.id === 'lightning') {
    if (side === 'monster') {
      if (Math.hypot(source!.x - w.hero.x, source!.y - w.hero.y) > LIGHTNING_RANGE) return false;
      if (!w.visible[Math.floor(source!.y) * w.grid.w + Math.floor(source!.x)]) return false;
      hurtHero(w, 0, 'spell', source, { type: 'electric', damage: power });
    } else {
      const target = w.monsters
        .filter((monster) => monster.hp > 0 && w.visible[Math.floor(monster.y) * w.grid.w + Math.floor(monster.x)])
        .filter((monster) => Math.hypot(monster.x - w.hero.x, monster.y - w.hero.y) <= LIGHTNING_RANGE)
        .sort((a, b) => Math.hypot(a.x - w.hero.x, a.y - w.hero.y) - Math.hypot(b.x - w.hero.x, b.y - w.hero.y))[0];
      if (!target) return false;
      hurtMonster(w, target, power, 'electric');
    }
    return true;
  }
  return false;
}
