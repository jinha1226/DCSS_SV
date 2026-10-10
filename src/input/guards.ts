/**
 * Keeps the page from zooming under the player's fingers. The viewport line and `touch-action`
 * cover most browsers; these cover the rest (Safari ignores `user-scalable=no`).
 */
export function guardZoom(root: HTMLElement): void {
  // Two fingers: Safari's own pinch events.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  // A second finger anywhere must not start a pinch.
  root.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
  // Two quick taps: the second one is taken away from the browser and handed on as a plain click.
  let lastEnd = 0;
  root.addEventListener(
    'touchend',
    (e) => {
      const now = e.timeStamp;
      if (now - lastEnd < 350) {
        e.preventDefault();
        if (e.target instanceof HTMLElement) e.target.click();
      }
      lastEnd = now;
    },
    { passive: false },
  );
}
