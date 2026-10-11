import { HERO } from '../data/hero';
import type { World } from '../sim/world';

export interface ThrowButton { readonly held: boolean; show(w: World): void }

/** A second pointer may throw while the first continues steering the canvas stick. */
export function makeThrowButton(root: HTMLElement): ThrowButton {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'throw-button';
  button.innerHTML = '던지기<span class="cooldown"></span>';
  root.append(button);
  const cooldown = button.querySelector<HTMLElement>('.cooldown')!;
  const active = new Set<number>();
  button.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    active.add(e.pointerId);
    button.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  });
  const release = (e: PointerEvent): void => { active.delete(e.pointerId); };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  window.addEventListener('blur', () => active.clear());
  return {
    get held() { return active.size > 0; },
    show(w) {
      const remaining = Math.max(0, w.hero.throwing);
      cooldown.textContent = remaining > 0 ? remaining.toFixed(1) + '초' : '준비';
      button.style.setProperty('--ready', String(1 - remaining / HERO.thrown.every));
    },
  };
}
