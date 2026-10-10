import '../styles/main.css';
import { guardZoom } from '../input/guards';
import { keyPush, watchKeys } from '../input/keys';
import { makeStick } from '../input/stick';
import { makeTestFloor } from '../sim/testFloor';
import { makeWorld, stepWorld } from '../sim/world';
import { makePanel } from '../ui/panel';
import { loadAtlas } from '../view/atlas';
import { LOOK } from '../view/look';
import { cellPixels, drawWorld } from '../view/render';
import { runLoop } from './loop';
import { COLS, readSwitches, writeSwitches } from './switches';

/** Stage 1: the hero walks a hand-made floor. Nothing fights yet. */
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
  const world = makeWorld(makeTestFloor(), switches.speed);
  const stick = makeStick(canvas, root);
  const keys = watchKeys();

  const remember = (): void => history.replaceState(null, '', location.pathname + writeSwitches(switches));
  const panel = makePanel(root, (add) => {
    add<number>({
      title: '걷는 속도',
      options: [3.5, 4.5, 5.5, 6.5].map((value) => ({ value, text: String(value) })),
      get: () => switches.speed,
      set: (value) => {
        switches.speed = world.speed = value;
        remember();
      },
    });
    add<number>({
      title: '가로 칸 수',
      options: [COLS.normal, COLS.wide].map((value) => ({ value, text: `${value}칸` })),
      get: () => switches.cols,
      set: (value) => {
        switches.cols = value;
        remember();
      },
    });
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
    },
    (between) => {
      fit();
      drawWorld(ctx, atlas, world, { cols: switches.cols, look: LOOK[switches.look] }, between);
      const px = Math.round(cellPixels(canvas.width, switches.cols) / dpr);
      panel.caption(`1단계 · 걷기 — 1초에 ${world.speed}칸, 한 칸 ${px}px`);
    },
  );

  if (switches.debug) Object.assign(window, { __sv: { world, switches, stick, keys } });
}

start().catch((error: unknown) => {
  const fail = document.createElement('div');
  fail.className = 'fail';
  fail.textContent = error instanceof Error ? error.message : String(error);
  document.body.append(fail);
});
