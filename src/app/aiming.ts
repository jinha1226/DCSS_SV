import { spellData } from '../data/spells';
import { throwCandidates } from '../sim/combat';
import { spellCandidates } from '../sim/spells';
import type { Monster, World } from '../sim/world';
import type { SpellButtons } from '../ui/spellButtons';
import { cellPixels } from '../view/render';
import type { World3D } from '../view3d/world3d';
import {
  aimConfirm,
  aimDrag,
  aimHover,
  aimPress,
  aimRelease,
  nearestOnScreen,
  startAim,
  type Aim,
  type AimResult,
  type AimState,
} from './aimState';

export type { Aim } from './aimState';

export interface Aiming {
  readonly current: Aim | undefined;
  readonly focus: Monster | undefined;
  readonly point?: { readonly x: number; readonly y: number };
  begin(aim: Aim): void;
  cancel(): void;
  confirm(): void;
  take(): AimResult;
}

export function viewForAim(
  w: World,
  aiming: Aiming,
): {
  readonly targetingSpell?: ReturnType<typeof spellData>;
  readonly targets?: readonly Monster[];
  readonly focus?: Monster;
  readonly throwAim?: {
    readonly targets: readonly Monster[];
    readonly focus?: Monster;
    readonly point?: { readonly x: number; readonly y: number };
  };
} {
  const current = aiming.current;
  if (current?.kind === 'throw') return { throwAim: { targets: throwCandidates(w), focus: aiming.focus, point: aiming.point } };
  if (current?.kind === 'spell') {
    const spell = spellData(current.id);
    return { targetingSpell: spell, targets: spellCandidates(w, spell), focus: aiming.focus };
  }
  return {};
}

/** Maps a pointer to the common floor coordinates used by both renderers. */
export function makeFloorPoint(
  canvas: HTMLCanvasElement,
  getWorld: () => World | undefined,
  world3d: World3D | undefined,
  getViewCols: () => number,
): (event: PointerEvent) => { x: number; y: number } | undefined {
  return (event) => {
    const world = getWorld();
    if (!world) return undefined;
    const rect = canvas.getBoundingClientRect();
    const u = (event.clientX - rect.left) / rect.width;
    const v = (event.clientY - rect.top) / rect.height;
    if (world3d) return world3d.pick(u, v);
    const sx = u * canvas.width;
    const sy = v * canvas.height;
    const px = cellPixels(canvas.width, getViewCols());
    return { x: world.hero.x + (sx - canvas.width / 2) / px, y: world.hero.y + (sy - canvas.height / 2) / px };
  };
}

function screenTarget(
  canvas: HTMLCanvasElement,
  w: World,
  world3d: World3D | undefined,
  viewCols: number,
  event: PointerEvent,
  aim: Aim,
): Monster | undefined {
  const rect = canvas.getBoundingClientRect();
  const pointer = { u: (event.clientX - rect.left) / rect.width, v: (event.clientY - rect.top) / rect.height };
  const candidates = aim.kind === 'throw' ? throwCandidates(w) : spellCandidates(w, spellData(aim.id));
  const px = cellPixels(canvas.width, viewCols);
  return nearestOnScreen(
    candidates,
    pointer,
    world3d
      ? (monster, height) => world3d.project(monster.x, monster.y, height)
      : (monster) => ({
          u: (canvas.width / 2 + (monster.x - w.hero.x) * px) / canvas.width,
          v: (canvas.height / 2 + (monster.y - w.hero.y) * px) / canvas.height,
        }),
    rect.width / rect.height,
  );
}

export function makeAiming(
  canvas: HTMLCanvasElement,
  floorPoint: (event: PointerEvent) => { readonly x: number; readonly y: number } | undefined,
  getWorld: () => World | undefined,
  spellButtons: SpellButtons,
  world3d?: World3D,
  getViewCols: () => number = () => 12,
): Aiming {
  let state: AimState | undefined;
  let activePointer: number | undefined;
  let queued: AimResult = {};

  const clearPointer = (): void => {
    const pointer = activePointer;
    activePointer = undefined;
    if (pointer === undefined) return;
    try {
      if (canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
    } catch {
      // Browsers may release capture before the pointerup listener runs.
    }
  };
  const finish = (): void => {
    state = undefined;
    clearPointer();
    spellButtons.cancelTarget();
  };
  const cancel = (): void => {
    queued = {};
    finish();
  };
  const swallow = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (!state) return;
      swallow(event);
      if (activePointer !== undefined && event.pointerId !== activePointer) return;
      const w = getWorld();
      const point = floorPoint(event);
      if (!w || !point) return;
      const picked = screenTarget(canvas, w, world3d, getViewCols(), event, state.aim);
      state = activePointer === undefined ? aimHover(w, state, point, picked) : aimDrag(w, state, point, picked);
    },
    true,
  );

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (!state) return;
      swallow(event);
      if (event.pointerType === 'mouse' && event.button !== 0) {
        cancel();
        return;
      }
      if (activePointer !== undefined) return;
      const w = getWorld();
      const point = floorPoint(event);
      if (!w || !point) return;
      const picked = screenTarget(canvas, w, world3d, getViewCols(), event, state.aim);
      activePointer = event.pointerId;
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // A pointer that cannot be captured still aims while it stays over the canvas.
      }
      state = aimPress(w, state, point, picked);
    },
    true,
  );

  canvas.addEventListener(
    'pointerup',
    (event) => {
      if (!state) return;
      swallow(event);
      if (event.pointerId !== activePointer) return;
      const w = getWorld();
      const point = floorPoint(event);
      if (w && point) state = aimDrag(w, state, point, screenTarget(canvas, w, world3d, getViewCols(), event, state.aim));
      const result = w ? aimRelease(w, state) : undefined;
      if (result) {
        queued = result;
        finish();
      } else {
        state = { ...state, pressing: false };
        clearPointer();
      }
    },
    true,
  );

  canvas.addEventListener(
    'pointercancel',
    (event) => {
      if (!state) return;
      swallow(event);
      if (event.pointerId !== activePointer) return;
      state = { ...state, pressing: false };
      clearPointer();
    },
    true,
  );

  canvas.addEventListener(
    'contextmenu',
    (event) => {
      if (state) {
        cancel();
        event.stopImmediatePropagation();
      }
      event.preventDefault();
    },
    true,
  );
  window.addEventListener('keydown', (event) => {
    if (!state || event.defaultPrevented || event.key !== 'Escape') return;
    cancel();
    event.preventDefault();
  });

  return {
    get current() {
      return state?.aim;
    },
    get focus() {
      return state?.focus;
    },
    get point() {
      return state?.point;
    },
    begin(aim) {
      queued = {};
      clearPointer();
      const w = getWorld();
      state = w ? startAim(w, aim) : undefined;
      if (aim.kind === 'spell') spellButtons.beginTarget(aim.id);
      else spellButtons.cancelTarget();
    },
    cancel,
    confirm() {
      const w = getWorld();
      if (!w || !state) return;
      queued = aimConfirm(w, state) ?? {};
      finish();
    },
    take() {
      const result = queued;
      queued = {};
      return result;
    },
  };
}
