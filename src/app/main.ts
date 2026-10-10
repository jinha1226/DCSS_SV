import '../styles/main.css';
import { HERO } from '../data/hero';
import { guardZoom } from '../input/guards';
import { keyPush, watchKeys } from '../input/keys';
import { makeStick } from '../input/stick';
import { makeTestFloor } from '../sim/testFloor';
import { STEP, makeWorld, stepWorld, type World } from '../sim/world';
import { makeHud } from '../ui/hud';
import { loadAtlas } from '../view/atlas';
import { Fx } from '../view/fx';
import { LOOK } from '../view/look';
import { drawWorld } from '../view/render';
import { makeWalk } from '../view/walk';
import { runLoop } from './loop';
import { readSwitches } from './switches';

/** Stage 2: goblins come for the hero on a hand-made floor, and the axe swings by itself. */
async function start(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) return;
  guardZoom(root);

  const canvas = document.createElement('canvas');
  root.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const switches = readSwitches(location.search);
  const atlas = await loadAtlas();
  const heroWalk = makeWalk(atlas, 'hero/minotaur', HERO.walk);
  const stick = makeStick(canvas, root);
  const keys = watchKeys();
  const fx = new Fx();

  // A seed in the address gives the same run every time; without one each run differs.
  const begin = (): World =>
    makeWorld(makeTestFloor(), { seed: switches.seed || (Date.now() & 0x7fffffff), speed: switches.speed });
  let world = begin();
  const debug: { world: World } | undefined = switches.debug ? { world } : undefined;
  if (debug) Object.assign(window, { __sv: Object.assign(debug, { switches, stick, keys, heroWalk }) });

  const hud = makeHud(root, () => {
    world = begin();
    fx.clear();
    if (debug) debug.world = world;
  });

  let dpr = 1;
  const fit = (): void => {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  };

  runLoop(
    () => {
      const key = keyPush(keys);
      stepWorld(world, { mx: stick.x + key.x, my: stick.y + key.y });
      fx.take(world.events);
      fx.step(STEP);
    },
    (between) => {
      fit();
      // A world that has stopped is drawn where it stopped, not between two steps.
      drawWorld(ctx, atlas, world, { cols: switches.cols, look: LOOK[switches.look], dpr, heroWalk }, fx, world.over ? 1 : between);
      hud.show(world);
    },
  );
}

start().catch((error: unknown) => {
  const fail = document.createElement('div');
  fail.className = 'fail';
  fail.textContent = error instanceof Error ? error.message : String(error);
  document.body.append(fail);
});
