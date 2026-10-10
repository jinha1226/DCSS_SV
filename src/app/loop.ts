import { STEP } from '../sim/world';

/**
 * Runs the rules in fixed steps and draws once a frame. `draw` is told how far the frame falls
 * between the last step and the next (0 to 1), so movement stays smooth on a fast screen.
 * A hidden tab stands still, and a long stall is not made up for in a burst.
 */
export function runLoop(step: () => void, draw: (between: number) => void): void {
  let last = performance.now();
  let owed = 0;
  const frame = (now: number): void => {
    owed += Math.min(0.1, (now - last) / 1000);
    last = now;
    let done = 0;
    while (owed >= STEP && done < 8) {
      step();
      owed -= STEP;
      done++;
    }
    if (owed >= STEP) owed = 0;
    draw(owed / STEP);
    requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange', () => {
    last = performance.now();
    owed = 0;
  });
  requestAnimationFrame(frame);
}
