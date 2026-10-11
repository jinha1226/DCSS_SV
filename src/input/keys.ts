// Keys are read by where they sit on the board, not by the letter they type, so they work the
// same with a Korean layout switched on.
const LEFT = ['KeyA', 'ArrowLeft'];
const RIGHT = ['KeyD', 'ArrowRight'];
const UP = ['KeyW', 'ArrowUp'];
const DOWN = ['KeyS', 'ArrowDown'];
const OURS = new Set([...LEFT, ...RIGHT, ...UP, ...DOWN, 'Space', 'KeyJ', 'ShiftLeft', 'KeyK']);

/** The direction the held keys ask for: each of x, y is -1, 0 or 1. */
export function keyPush(down: ReadonlySet<string>): { x: number; y: number } {
  const any = (codes: readonly string[]): number => (codes.some((c) => down.has(c)) ? 1 : 0);
  return { x: any(RIGHT) - any(LEFT), y: any(DOWN) - any(UP) };
}

/** Follows which movement keys are held. */
export function watchKeys(): ReadonlySet<string> {
  const down = new Set<string>();
  window.addEventListener('keydown', (e) => {
    if (!OURS.has(e.code) || e.ctrlKey || e.metaKey || e.altKey) return;
    down.add(e.code);
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  // A key let go while the window is elsewhere would otherwise stay held.
  window.addEventListener('blur', () => down.clear());
  document.addEventListener('visibilitychange', () => down.clear());
  return down;
}
