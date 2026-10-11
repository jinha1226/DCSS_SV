import type { World } from './types';
import { walkable } from './grid';
import { computeFov } from './fov';
import { updateFlow } from './flow';
import { recordKill } from './kills';

export type ConsumableId = 'potion_healing' | 'scroll_blink' | 'wand_sparks';
export const CONSUMABLES: Readonly<Record<ConsumableId, { name: string; action: string }>> = {
  potion_healing: { name: '회복 물약', action: '마시기' },
  scroll_blink: { name: '점멸 두루마리', action: '읽기' },
  wand_sparks: { name: '전격 완드', action: '사용' },
};
export const consumableName = (id: string): string => CONSUMABLES[id as ConsumableId]?.name ?? id;

export function addConsumable(w: World, id: ConsumableId, count = 1): void {
  const entry = w.inventory.find((item) => item.kind === 'consumable' && item.id === id);
  if (entry?.kind === 'consumable') entry.count += count;
  else w.inventory.push({ uid: id, kind: 'consumable', id, count });
}

/** Uses one item only when its effect can actually be applied. */
export function useConsumable(w: World, id: ConsumableId): boolean {
  if (w.over || w.choosing || w.pendingPickup) return false;
  const index = w.inventory.findIndex((item) => item.kind === 'consumable' && item.id === id);
  const item = w.inventory[index];
  if (!item || item.kind !== 'consumable' || item.count <= 0) return false;
  if (id === 'potion_healing') {
    if (w.hero.hp >= w.hero.maxHp) return false;
    w.hero.hp = Math.min(w.hero.maxHp, w.hero.hp + 30);
  } else if (id === 'scroll_blink') {
    const choices: { x: number; y: number }[] = [];
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const x = Math.floor(w.hero.x) + dx;
        const y = Math.floor(w.hero.y) + dy;
        if ((dx === 0 && dy === 0) || !walkable(w.grid, x, y) || !w.visible[y * w.grid.w + x]) continue;
        if (w.monsters.some((monster) => Math.hypot(monster.x - (x + 0.5), monster.y - (y + 0.5)) < 0.9)) continue;
        choices.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
    if (!choices.length) return false;
    const destination = choices[Math.floor(w.rng() * choices.length)]!;
    w.hero.x = w.hero.px = destination.x;
    w.hero.y = w.hero.py = destination.y;
    computeFov(w.grid, Math.floor(destination.x), Math.floor(destination.y), w.heroDef.sight, w.visible);
    for (let i = 0; i < w.visible.length; i++) if (w.visible[i]) w.seen[i] = 1;
    updateFlow(w.flow, w.grid, Math.floor(destination.x), Math.floor(destination.y));
  } else {
    const target = w.monsters
      .filter((monster) => monster.hp > 0 && w.visible[Math.floor(monster.y) * w.grid.w + Math.floor(monster.x)])
      .filter((monster) => Math.hypot(monster.x - w.hero.x, monster.y - w.hero.y) <= 7)
      .sort((a, b) => Math.hypot(a.x - w.hero.x, a.y - w.hero.y) - Math.hypot(b.x - w.hero.x, b.y - w.hero.y))[0];
    if (!target) return false;
    target.hp = Math.max(0, target.hp - 8);
    target.flash = 0.12;
    w.events.push({ type: 'elemental', x: target.x, y: target.y, amount: 8, element: 'electric', target: 'monster' });
    if (target.hp <= 0) {
      // The kill pipeline handles experience, healing, and the message log.
      // Import lazily is unnecessary because kills only depends on skills.
      recordKill(w, target);
    }
  }
  item.count--;
  if (item.count === 0) w.inventory.splice(index, 1);
  return true;
}
