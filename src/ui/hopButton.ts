import { hopTrait } from '../sim/traits';
import type { World } from '../sim/world';

export interface HopButton {
  readonly held: boolean;
  show(w: World): void;
}
export function makeHopButton(root: HTMLElement): HopButton {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hop-button';
  button.innerHTML = '도약<span class="cooldown"></span>';
  root.append(button);
  const cooldown = button.querySelector<HTMLElement>('.cooldown')!,
    active = new Set<number>();
  button.addEventListener('pointerdown', (e) => {
    if (button.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    active.add(e.pointerId);
    button.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
  });
  const release = (e: PointerEvent): void => {
    active.delete(e.pointerId);
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  window.addEventListener('blur', () => active.clear());
  return {
    get held() {
      return active.size > 0;
    },
    show(w) {
      const rule = hopTrait(w),
        remaining = Math.max(0, w.hero.hopCooldown);
      button.classList.toggle('on', Boolean(rule));
      button.disabled = !rule || remaining > 0;
      cooldown.textContent = !rule ? '' : remaining > 0 ? remaining.toFixed(1) + '초' : '준비';
    },
  };
}
