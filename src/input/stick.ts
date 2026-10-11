/** Where the stick stands, for whoever moves the hero. `x`, `y` is at most 1 long. */
export interface StickState {
  x: number;
  y: number;
  held: boolean;
  enabled: boolean;
}

/** How far the thumb travels from the stick's middle to full speed, in CSS pixels. */
export const STICK_REACH = 46;
/** Inside this share of the reach the stick reads as still. */
const DEAD = 0.14;

/** Turns an offset from the stick's middle into a push between 0 and 1. */
export function stickPush(dx: number, dy: number): { x: number; y: number } {
  const d = Math.hypot(dx, dy);
  const share = Math.min(1, d / STICK_REACH);
  if (share < DEAD) return { x: 0, y: 0 };
  const push = (share - DEAD) / (1 - DEAD);
  return { x: (dx / d) * push, y: (dy / d) * push };
}

/**
 * A stick that appears where the thumb comes down on `surface`. It follows one finger from touch
 * to lift, so nothing but lifting that finger lets go of it; pushed past its reach, its middle
 * trails after the thumb, so turning round takes a short pull rather than a long one.
 */
export function makeStick(surface: HTMLElement, root: HTMLElement): StickState {
  const state: StickState = { x: 0, y: 0, held: false, enabled: true };
  const base = document.createElement('div');
  base.className = 'stick';
  const nub = document.createElement('div');
  nub.className = 'nub';
  base.append(nub);
  root.append(base);

  let pointer = -1;
  let ox = 0;
  let oy = 0;

  const place = (px: number, py: number): void => {
    let dx = px - ox;
    let dy = py - oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_REACH) {
      ox += (dx / d) * (d - STICK_REACH);
      oy += (dy / d) * (d - STICK_REACH);
      dx = px - ox;
      dy = py - oy;
    }
    const push = stickPush(dx, dy);
    state.x = push.x;
    state.y = push.y;
    base.style.transform = `translate(${ox}px, ${oy}px)`;
    nub.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const release = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return;
    pointer = -1;
    state.x = 0;
    state.y = 0;
    state.held = false;
    base.classList.remove('on');
  };

  surface.addEventListener('pointerdown', (e) => {
    if (!state.enabled || pointer !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointer = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    state.held = true;
    base.classList.add('on');
    place(e.clientX, e.clientY);
    try {
      surface.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that cannot be captured still steers while it stays over the surface.
    }
    e.preventDefault();
  });
  surface.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointer) place(e.clientX, e.clientY);
  });
  surface.addEventListener('pointerup', release);
  surface.addEventListener('pointercancel', release);
  return state;
}
