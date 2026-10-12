export interface GameZoom {
  readonly scale: number;
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 3;
const clamp = (scale: number): number => Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));

/** Zooms the game camera; two fingers on the canvas temporarily release the movement stick. */
export function makeGameZoom(surface: HTMLElement, cancelMovement: () => void): GameZoom {
  let scale = 1;
  let pinching = false;
  let previousDistance = 0;
  const fingers = new Map<number, { x: number; y: number }>();
  const distance = (): number => {
    const [a, b] = [...fingers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const consume = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  surface.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? surface.clientHeight : 1;
      scale = clamp(scale * Math.exp(-Math.max(-400, Math.min(400, event.deltaY * unit)) * 0.002));
    },
    { passive: false },
  );
  surface.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'touch') return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.size < 2 && !pinching) return;
      pinching = true;
      previousDistance = distance();
      cancelMovement();
      for (const id of fingers.keys()) {
        try {
          surface.setPointerCapture(id);
        } catch {
          // Continue handling fingers while they are on the canvas.
        }
      }
      consume(event);
    },
    true,
  );
  surface.addEventListener(
    'pointermove',
    (event) => {
      if (!fingers.has(event.pointerId)) return;
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (!pinching) return;
      const nextDistance = distance();
      if (previousDistance > 0 && nextDistance > 0) scale = clamp(scale * (nextDistance / previousDistance));
      previousDistance = nextDistance;
      consume(event);
    },
    true,
  );
  const release = (event: PointerEvent): void => {
    if (!fingers.delete(event.pointerId)) return;
    if (pinching) consume(event);
    previousDistance = distance();
    // Keep the remaining finger from suddenly becoming a movement gesture.
    if (!fingers.size) pinching = false;
  };
  surface.addEventListener('pointerup', release, true);
  surface.addEventListener('pointercancel', release, true);
  surface.addEventListener('lostpointercapture', release, true);
  window.addEventListener('blur', () => {
    fingers.clear();
    pinching = false;
    previousDistance = 0;
    cancelMovement();
  });
  return {
    get scale() {
      return scale;
    },
  };
}
