import { selfSpell, spellData } from '../data/spells';
import { throwAimTarget, throwCandidates } from '../sim/combat';
import { spellAtPoint, spellCandidates } from '../sim/spells';
import type { Monster, World } from '../sim/world';
import type { SpellButtons } from '../ui/spellButtons';
import { cellPixels } from '../view/render';
import type { World3D } from '../view3d/world3d';

export type Aim = { readonly kind: 'spell'; readonly id: string } | { readonly kind: 'throw' };

export interface AimResult {
  readonly spell?: { readonly id: string; readonly x: number; readonly y: number };
  readonly throwAt?: { readonly x: number; readonly y: number };
}

export interface Aiming {
  readonly current: Aim | undefined;
  readonly focus: Monster | undefined;
  begin(aim: Aim): void;
  cancel(): void;
  take(): AimResult;
}

export function viewForAim(
  w: World,
  aiming: Aiming,
): {
  readonly targetingSpell?: ReturnType<typeof spellData>;
  readonly targets?: readonly Monster[];
  readonly focus?: Monster;
  readonly throwAim?: { readonly targets: readonly Monster[]; readonly focus?: Monster };
} {
  const current = aiming.current;
  if (current?.kind === 'throw') return { throwAim: { targets: throwCandidates(w), focus: aiming.focus } };
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
    const sx = (event.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (event.clientY - rect.top) * (canvas.height / rect.height);
    if (world3d) return world3d.pick(sx, sy);
    const px = cellPixels(canvas.width, getViewCols());
    return { x: world.hero.x + (sx - canvas.width / 2) / px, y: world.hero.y + (sy - canvas.height / 2) / px };
  };
}

export function makeAiming(
  canvas: HTMLCanvasElement,
  floorPoint: (event: PointerEvent) => { readonly x: number; readonly y: number } | undefined,
  getWorld: () => World | undefined,
  spellButtons: SpellButtons,
): Aiming {
  let current: Aim | undefined;
  let focus: Monster | undefined;
  let queued: AimResult = {};

  const finish = (): void => {
    current = undefined;
    focus = undefined;
    spellButtons.cancelTarget();
  };
  const cancel = (): void => {
    queued = {};
    finish();
  };

  canvas.addEventListener('pointermove', (event) => {
    const w = getWorld();
    const point = floorPoint(event);
    if (!w || !current || !point) {
      focus = undefined;
      return;
    }
    focus = current.kind === 'throw' ? throwAimTarget(w, point.x, point.y) : spellAtPoint(w, spellData(current.id), point.x, point.y);
  });

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      const w = getWorld();
      if (!w || !current) return;
      if (event.pointerType === 'mouse' && event.button !== 0) {
        cancel();
      } else {
        const point = floorPoint(event);
        if (!point) return;
        if (current.kind === 'throw') {
          queued = { throwAt: point };
          finish();
        } else {
          const spell = spellData(current.id);
          if (selfSpell(spell)) return;
          const target = spellAtPoint(w, spell, point.x, point.y);
          if (!target) return;
          queued = { spell: { id: spell.id, x: target.x, y: target.y } };
          finish();
        }
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  canvas.addEventListener('contextmenu', (event) => {
    if (current) cancel();
    event.preventDefault();
  });
  window.addEventListener('keydown', (event) => {
    if (!current || event.defaultPrevented || event.key !== 'Escape') return;
    cancel();
    event.preventDefault();
  });

  return {
    get current() {
      return current;
    },
    get focus() {
      return focus;
    },
    begin(aim) {
      queued = {};
      current = aim;
      focus = undefined;
      if (aim.kind === 'spell') spellButtons.beginTarget(aim.id);
      else spellButtons.cancelTarget();
    },
    cancel,
    take() {
      const result = queued;
      queued = {};
      return result;
    },
  };
}
