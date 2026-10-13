import { moveCircle, wallGap } from '../../src/sim/collide';
import { throwTarget } from '../../src/sim/combat';
import { acceptPickup, declinePickup, weaponScore } from '../../src/sim/equipment';
import { Cell, cellAt, walkable } from '../../src/sim/grid';
import { chooseSkill, effectValue, skillLevel } from '../../src/sim/skills';
import { chooseReward } from '../../src/sim/rewards';
import { SLOTS, slotData, upgradeSlot } from '../../src/sim/slots';
import { makeWorld, stepWorld, type Input, type SkillChoice, type World } from '../../src/sim/world';

export type Bot = (w: World) => Input;
export type Chooser = (cards: readonly SkillChoice[], w: World) => string;
export const still: Bot = () => ({ mx: 0, my: 0 });

function nearestAwake(w: World): { dx: number; dy: number; d: number } | undefined {
  let best: { dx: number; dy: number; d: number } | undefined;
  for (const m of w.monsters) {
    if (!m.awake) continue;
    const dx = m.x - w.hero.x;
    const dy = m.y - w.hero.y;
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { dx, dy, d };
  }
  return best;
}

export const flee: Bot = (w) => {
  const near = nearestAwake(w);
  if (!near || near.d > 6) return { mx: 0, my: 0 };
  return { mx: -near.dx / near.d, my: -near.dy / near.d };
};

export const kite: Bot = (w) => {
  const near = nearestAwake(w);
  if (!near) return { mx: 0, my: 0 };
  const nx = near.dx / near.d;
  const ny = near.dy / near.d;
  const want = w.weapon.range + effectValue(w, 'axe.wide') - 0.15;
  if (near.d > want + 0.6) return { mx: 0, my: 0 };
  const away = near.d < want ? 1 : 0.2;
  return { mx: -nx * away - ny * 0.7, my: -ny * away + nx * 0.7 };
};

const DIRS = Array.from({ length: 16 }, (_, i) => ({
  x: Math.cos((i / 16) * Math.PI * 2),
  y: Math.sin((i / 16) * Math.PI * 2),
}));

export const dance: Bot = (w) => {
  const ahead = 0.25;
  const near = w.monsters.filter((m) => m.awake && Math.hypot(m.x - w.hero.x, m.y - w.hero.y) < 8);
  if (!near.length) return { mx: 0, my: 0 };
  let best = { mx: 0, my: 0 };
  let bestScore = -Infinity;
  for (const dir of [{ x: 0, y: 0 }, ...DIRS]) {
    const to = moveCircle(w.grid, w.hero, w.heroDef.radius, dir.x * w.speed * ahead, dir.y * w.speed * ahead);
    let score = 0;
    let inReach = false;
    for (const m of near) {
      const d0 = Math.hypot(m.x - to.x, m.y - to.y);
      const d = Math.max(0.6, d0 - (m.stun > 0 ? 0 : m.stats.speed * ahead));
      const strike = w.heroDef.radius + m.stats.reach + 0.25;
      if (d < strike) score -= 10 * (strike - d + 0.3);
      if (d0 <= w.weapon.range + effectValue(w, 'axe.wide') - 0.05) inReach = true;
    }
    if (inReach) score += 2;
    score += Math.min(1.5, wallGap(w.grid, to)) * 0.4;
    if (dir.x || dir.y) score -= (1 - Math.hypot(to.x - w.hero.x, to.y - w.hero.y) / (w.speed * ahead)) * 2;
    if (score > bestScore) {
      bestScore = score;
      best = { mx: dir.x, my: dir.y };
    }
  }
  return best;
};

function route(w: World, target: (x: number, y: number) => boolean): Input | undefined {
  const sx = Math.floor(w.hero.x);
  const sy = Math.floor(w.hero.y);
  const size = w.grid.w * w.grid.h;
  const prev = new Int32Array(size);
  prev.fill(-2);
  const start = sy * w.grid.w + sx;
  const queue: number[] = [start];
  prev[start] = -1;
  let end = -1;
  for (let at = 0; at < queue.length; at++) {
    const i = queue[at]!;
    const x = i % w.grid.w;
    const y = Math.floor(i / w.grid.w);
    if (target(x, y)) {
      end = i;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const ni = ny * w.grid.w + nx;
      if (nx < 0 || ny < 0 || nx >= w.grid.w || ny >= w.grid.h) continue;
      if (prev[ni] !== -2 || !w.seen[ni] || !walkable(w.grid, nx, ny)) continue;
      prev[ni] = i;
      queue.push(ni);
    }
  }
  if (end < 0) return undefined;
  if (end === start) return { mx: 0, my: 0 };
  let step = end;
  while (prev[step] !== start && prev[step]! >= 0) step = prev[step]!;
  const tx = (step % w.grid.w) + 0.5;
  const ty = Math.floor(step / w.grid.w) + 0.5;
  const dx = tx - w.hero.x;
  const dy = ty - w.hero.y;
  const d = Math.hypot(dx, dy) || 1;
  return { mx: dx / d, my: dy / d };
}

export const explore: Bot = (w) => {
  const near = nearestAwake(w);
  if (near && near.d < 7) return { ...dance(w), throw: Boolean(throwTarget(w)) };
  if (cellAt(w.grid, Math.floor(w.hero.x), Math.floor(w.hero.y)) === Cell.StairsDown) return { mx: 0, my: 0 };
  const stair = new Set(w.stairs.filter((s) => s.down && w.seen[s.y * w.grid.w + s.x]).map((s) => s.y * w.grid.w + s.x));
  const toStair = route(w, (x, y) => stair.has(y * w.grid.w + x));
  if (toStair) return { ...toStair, throw: Boolean(throwTarget(w)) };
  const frontier = (x: number, y: number): boolean => {
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w.grid.w && ny < w.grid.h && !w.seen[ny * w.grid.w + nx]) return true;
    }
    return false;
  };
  return { ...(route(w, frontier) ?? { mx: 0, my: 0 }), throw: Boolean(throwTarget(w)) };
};

export const bowFirst: Chooser = (cards) =>
  cards.find((c) => c.id === 'ranged')?.id ??
  cards.find((c) => c.id === 'fighting')?.id ??
  cards.find((c) => c.id === 'dodging')?.id ??
  cards[0]!.id;

export const axeFirst: Chooser = (cards) =>
  cards.find((c) => c.id === 'axe')?.id ?? cards.find((c) => c.id === 'fighting')?.id ?? cards[0]!.id;

export const defenceFirst: Chooser = (cards, w) => {
  for (const id of ['armour', 'shield', 'dodging']) {
    if (skillLevel(w, id) >= 8) continue;
    const card = cards.find((c) => c.id === id);
    if (card) return id;
  }
  return cards[0]!.id;
};

export const hunterExplore: Bot = (w) => {
  const visible = w.monsters
    .filter((m) => m.awake && m.hp > 0 && Boolean(w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]))
    .map((m) => ({ m, dx: m.x - w.hero.x, dy: m.y - w.hero.y, d: Math.hypot(m.x - w.hero.x, m.y - w.hero.y) }))
    .sort((a, b) => a.d - b.d);
  if (!visible.length) return explore(w);

  const near = visible.filter((entry) => entry.d < 2.6);
  let awayX = 0;
  let awayY = 0;
  for (const entry of visible) {
    const weight = 1 / Math.max(0.5, entry.d);
    awayX -= (entry.dx / (entry.d || 1)) * weight;
    awayY -= (entry.dy / (entry.d || 1)) * weight;
  }
  const awayD = Math.hypot(awayX, awayY) || 1;
  awayX /= awayD;
  awayY /= awayD;

  if (near.length >= 2 && w.hero.hopCooldown <= 0) {
    return { mx: awayX, my: awayY, hop: true, throw: Boolean(throwTarget(w)) };
  }

  const nearest = visible[0]!;
  const ideal = Math.min(w.heroDef.sight - 0.4, w.weapon.range + effectValue(w, 'ranged.range') - 0.5);
  if (nearest.d < ideal - 0.8) return { mx: awayX, my: awayY, throw: Boolean(throwTarget(w)) };
  if (nearest.d > ideal + 0.6) return { mx: nearest.dx / nearest.d, my: nearest.dy / nearest.d, throw: Boolean(throwTarget(w)) };
  return { mx: (-nearest.dy / nearest.d) * 0.55, my: (nearest.dx / nearest.d) * 0.55, throw: Boolean(throwTarget(w)) };
};

export interface RunResult {
  readonly seconds: number;
  readonly kills: number;
  readonly hp: number;
  readonly taken: number;
  readonly fell: boolean;
  readonly depth: number;
  readonly won: boolean;
  readonly level: number;
  readonly mainSkill: string;
  readonly offered: number;
  readonly swapped: number;
  readonly throws: number;
  readonly recovered: number;
}

export interface PlayOptions {
  readonly species?: string;
  readonly job?: string;
}

export function play(bot: Bot, seed: number, limit: number, chooser: Chooser = axeFirst, options: PlayOptions = {}): RunResult {
  const w = makeWorld({ seed, ...options });
  let taken = 0;
  while (!w.over && w.time < limit) {
    if (w.pendingPickup) {
      const found = w.pendingPickup.axe;
      if (found && weaponScore(found) > weaponScore(w.weapon)) acceptPickup(w);
      else declinePickup(w);
      continue;
    }
    if (w.pendingRewards[0] === 'slot') {
      const preferred = w.hero.slotLevels.weapon < slotData('weapon').cap ? 'weapon' : 'body';
      const id =
        w.hero.slotLevels[preferred] < slotData(preferred).cap
          ? preferred
          : SLOTS.find((slot) => w.hero.slotLevels[slot.id] < slot.cap)?.id;
      if (id) upgradeSlot(w, id, id === 'ring1' || id === 'ring2' ? 'fire' : undefined);
      continue;
    }
    if (w.rewardChoices) {
      chooseReward(w, 'weapon');
      continue;
    }
    if (w.choosing) {
      chooseSkill(w, chooser(w.choosing, w));
      continue;
    }
    stepWorld(w, bot(w));
    for (const event of w.events.splice(0)) if (event.type === 'hurt') taken += event.amount;
  }
  return {
    seconds: w.time,
    kills: w.kills,
    hp: w.hero.hp,
    taken,
    fell: w.over && !w.won,
    depth: w.depth,
    won: w.won,
    level: w.hero.level,
    mainSkill: `${w.weapon.school ?? w.weapon.family} ${skillLevel(w, w.weapon.school ?? w.weapon.family)}`,
    offered: w.pickupStats.offered,
    swapped: w.pickupStats.swapped,
    throws: w.pickupStats.throws,
    recovered: w.pickupStats.recovered,
  };
}

export function summary(runs: readonly RunResult[]): string {
  const mean = (f: (r: RunResult) => number): number => runs.reduce((a, r) => a + f(r), 0) / runs.length;
  const times = runs.map((r) => r.seconds).sort((a, b) => a - b);
  const mainSkills = [...new Set(runs.map((r) => r.mainSkill))].join('/');
  return (
    'won ' +
    runs.filter((r) => r.won).length +
    '/' +
    runs.length +
    ', depth ' +
    mean((r) => r.depth).toFixed(1) +
    ', seconds ' +
    mean((r) => r.seconds).toFixed(0) +
    ' (' +
    times[0]!.toFixed(0) +
    '-' +
    times[times.length - 1]!.toFixed(0) +
    ')' +
    ', kills ' +
    mean((r) => r.kills).toFixed(0) +
    ', taken ' +
    mean((r) => r.taken).toFixed(0) +
    ', level ' +
    mean((r) => r.level).toFixed(1) +
    ', main skill ' +
    mainSkills +
    ', offers ' +
    mean((r) => r.offered).toFixed(1) +
    ', swaps ' +
    mean((r) => r.swapped).toFixed(1) +
    ', throws ' +
    mean((r) => r.throws).toFixed(1) +
    ', recovered ' +
    mean((r) => r.recovered).toFixed(1)
  );
}
