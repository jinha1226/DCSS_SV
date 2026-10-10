import '../styles/main.css';
import { guardZoom } from '../input/guards';
import { makeShowroom } from '../sim/showroom';
import { makePanel, type Choice } from '../ui/panel';
import { loadAtlas } from '../view/atlas';
import { LOOK, type LookName } from '../view/look';
import { drawShowroom } from '../view/render';
import { readSwitches, writeSwitches } from './switches';

/** Stage 0: one still room drawn in tiles, with switches to compare how it reads on a phone. */
async function start(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) return;
  guardZoom(root);

  const canvas = document.createElement('canvas');
  root.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const switches = readSwitches(location.search);
  const room = makeShowroom();
  const atlas = await loadAtlas();

  const draw = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const px = drawShowroom(ctx, atlas, room, { cols: switches.cols, look: LOOK[switches.look] }, dpr);
    panel.caption(`0단계 · 타일 보기 — 가로 ${switches.cols}칸, 한 칸 ${Math.round(px / dpr)}px`);
  };

  const change = (): void => {
    history.replaceState(null, '', location.pathname + writeSwitches(switches));
    draw();
  };

  const cols: Choice<number> = {
    title: '가로 칸 수',
    options: [11, 13, 15, 17].map((value) => ({ value, text: `${value}칸` })),
    get: () => switches.cols,
    set: (value) => {
      switches.cols = value;
      change();
    },
  };
  const look: Choice<LookName> = {
    title: '바닥과 벽',
    options: [
      { value: 'dcss', text: '원본 1층' },
      { value: 'bright', text: '밝은 돌' },
    ],
    get: () => switches.look,
    set: (value) => {
      switches.look = value;
      change();
    },
  };
  const panel = makePanel(root, [cols, look] as readonly Choice<unknown>[]);

  window.addEventListener('resize', draw);
  draw();

  if (switches.debug) Object.assign(window, { __sv: { switches, room, draw } });
}

start().catch((error: unknown) => {
  const fail = document.createElement('div');
  fail.className = 'fail';
  fail.textContent = error instanceof Error ? error.message : String(error);
  document.body.append(fail);
});
