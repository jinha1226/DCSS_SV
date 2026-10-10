import { HERO } from '../../src/data/hero';
import { moveCircle, wallGap } from '../../src/sim/collide';
import { makeTestFloor } from '../../src/sim/testFloor';
import { makeWorld, stepWorld, type Input, type World } from '../../src/sim/world';

/** A stand-in for a player: looks at the world and says which way to walk. */
export type Bot = (w: World) => Input;

/** Stands where it starts. */
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

/** Walks straight away from whatever is nearest, and stands when nothing is near. */
export const flee: Bot = (w) => {
  const near = nearestAwake(w);
  if (!near || near.d > 6) return { mx: 0, my: 0 };
  return { mx: -near.dx / near.d, my: -near.dy / near.d };
};

/**
 * Fights the way the game means to be played: lets the pack come just into the axe's reach,
 * backs off when it presses closer, and circles rather than backing into a wall.
 */
export const kite: Bot = (w) => {
  const near = nearestAwake(w);
  if (!near) return { mx: 0, my: 0 };
  const nx = near.dx / near.d;
  const ny = near.dy / near.d;
  const want = HERO.axe.reach - 0.15;
  if (near.d > want + 0.6) return { mx: 0, my: 0 }; // let them come
  const away = near.d < want ? 1 : 0.2;
  return { mx: -nx * away - ny * 0.7, my: -ny * away + nx * 0.7 };
};

const DIRS = Array.from({ length: 16 }, (_, i) => ({ x: Math.cos((i / 16) * Math.PI * 2), y: Math.sin((i / 16) * Math.PI * 2) }));

/**
 * Looks a quarter of a second ahead in sixteen directions (and standing still) and takes the one
 * that leaves it least threatened while keeping something in the axe's reach. This is the bot
 * that stands for a player who has the hang of it.
 */
export const dance: Bot = (w) => {
  const ahead = 0.25;
  const near = w.monsters.filter((m) => m.awake && Math.hypot(m.x - w.hero.x, m.y - w.hero.y) < 8);
  if (!near.length) return { mx: 0, my: 0 };
  let best = { mx: 0, my: 0 };
  let bestScore = -Infinity;
  for (const dir of [{ x: 0, y: 0 }, ...DIRS]) {
    const to = moveCircle(w.grid, w.hero, HERO.radius, dir.x * w.speed * ahead, dir.y * w.speed * ahead);
    let score = 0;
    let inReach = false;
    for (const m of near) {
      const d0 = Math.hypot(m.x - to.x, m.y - to.y);
      const d = Math.max(0.6, d0 - (m.stun > 0 ? 0 : m.stats.speed * ahead));
      const strike = HERO.radius + m.stats.reach + 0.25;
      if (d < strike) score -= 10 * (strike - d + 0.3);
      if (d0 <= HERO.axe.reach - 0.05) inReach = true;
    }
    if (inReach) score += 2;
    // Open ground is worth a little: a corner has fewer ways out.
    score += Math.min(1.5, wallGap(w.grid, to)) * 0.4;
    // Having moved less than asked means a wall or a body is in the way.
    if (dir.x || dir.y) score -= (1 - Math.hypot(to.x - w.hero.x, to.y - w.hero.y) / (w.speed * ahead)) * 2;
    if (score > bestScore) {
      bestScore = score;
      best = { mx: dir.x, my: dir.y };
    }
  }
  return best;
};

export interface RunResult {
  readonly seconds: number;
  readonly kills: number;
  readonly hp: number;
  readonly fell: boolean;
}

/** Plays one run with a bot, for at most `limit` seconds. */
export function play(bot: Bot, seed: number, limit: number): RunResult {
  const w = makeWorld(makeTestFloor(), { seed });
  while (!w.over && w.time < limit) stepWorld(w, bot(w));
  return { seconds: w.time, kills: w.kills, hp: w.hero.hp, fell: w.over };
}

export function summary(runs: readonly RunResult[]): string {
  const mean = (f: (r: RunResult) => number): number => runs.reduce((a, r) => a + f(r), 0) / runs.length;
  const fell = runs.filter((r) => r.fell).length;
  const times = runs.map((r) => r.seconds).sort((a, b) => a - b);
  return `fell ${fell}/${runs.length}, seconds ${mean((r) => r.seconds).toFixed(0)} (${times[0]!.toFixed(0)}-${times[times.length - 1]!.toFixed(0)}), kills ${mean((r) => r.kills).toFixed(0)}, hp left ${mean((r) => r.hp).toFixed(0)}`;
}
