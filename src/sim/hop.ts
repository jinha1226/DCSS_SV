import { moveCircle } from './collide';
import { walkable } from './grid';
import { hopTrait } from './traits';
import type { Input, World } from './types';

function occupied(w: World, x: number, y: number): boolean {
  return w.monsters.some((m) => m.hp > 0 && Math.hypot(m.x - x, m.y - y) < m.stats.radius + w.heroDef.radius + 0.05);
}
function landing(w: World, x: number, y: number): { x: number; y: number } {
  if (!occupied(w, x, y)) return { x, y };
  let best: { x: number; y: number; d: number } | undefined;
  for (let ring = 1; ring <= 3; ring++)
    for (let iy = -ring; iy <= ring; iy++)
      for (let ix = -ring; ix <= ring; ix++) {
        if (Math.max(Math.abs(ix), Math.abs(iy)) !== ring) continue;
        const tx = x + ix * 0.45,
          ty = y + iy * 0.45;
        if (!walkable(w.grid, Math.floor(tx), Math.floor(ty)) || occupied(w, tx, ty)) continue;
        const d = Math.hypot(tx - x, ty - y);
        if (!best || d < best.d) best = { x: tx, y: ty, d };
      }
  return best ? { x: best.x, y: best.y } : { x: w.hero.x, y: w.hero.y };
}
export function tryHop(w: World, input: Input): boolean {
  const rule = hopTrait(w),
    h = w.hero;
  if (!rule || h.hopCooldown > 0 || h.hopTime > 0) return false;
  let dx = input.mx,
    dy = input.my,
    d = Math.hypot(dx, dy);
  if (d < 0.1) {
    dx = h.facing;
    dy = 0;
    d = 1;
  }
  dx /= d;
  dy /= d;
  const distance = h.level >= rule.distanceLevel ? rule.distanceHigh : rule.distance;
  const moved = moveCircle(w.grid, h, w.heroDef.radius, dx * distance, dy * distance);
  const land = landing(w, moved.x, moved.y);
  h.hopFromX = h.x;
  h.hopFromY = h.y;
  h.hopToX = land.x;
  h.hopToY = land.y;
  h.x = land.x;
  h.y = land.y;
  h.px = h.x;
  h.py = h.y;
  h.hopTime = rule.duration;
  h.hopDuration = rule.duration;
  h.hopCooldown = rule.cooldown;
  h.invulnerable = Math.max(h.invulnerable, rule.duration);
  if (Math.abs(dx) > 0.15) h.facing = dx < 0 ? -1 : 1;
  return true;
}
export function tickHop(w: World, dt: number): void {
  const h = w.hero;
  if (h.hopCooldown > 0) h.hopCooldown = Math.max(0, h.hopCooldown - dt);
  if (h.hopTime > 0) h.hopTime = Math.max(0, h.hopTime - dt);
}
