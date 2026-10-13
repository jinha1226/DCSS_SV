import { throwCooldown } from '../sim/skills';
import { hopTrait } from '../sim/traits';
import type { World } from '../sim/world';

export interface ThrowButton {
  aiming: boolean;
  takePress(): boolean;
  show(w: World): void;
}
export function makeThrowButton(root: HTMLElement): ThrowButton {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'throw-button';
  button.innerHTML = '던지기<span class="ammo"></span><span class="cooldown"></span>';
  root.append(button);
  const cooldown = button.querySelector<HTMLElement>('.cooldown')!,
    ammo = button.querySelector<HTMLElement>('.ammo')!;
  let pressed = false;
  let aiming = false;
  button.addEventListener('pointerdown', (e) => {
    if (button.disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pressed = true;
    e.preventDefault();
    e.stopPropagation();
  });
  window.addEventListener('blur', () => {
    pressed = false;
  });
  return {
    get aiming() {
      return aiming;
    },
    set aiming(value) {
      aiming = value;
      button.classList.toggle('targeting', value);
    },
    takePress() {
      const value = pressed;
      pressed = false;
      return value;
    },
    show(w) {
      const open = w.openSkills.has('throwing'),
        remaining = Math.max(0, w.hero.throwing);
      button.classList.toggle('on', open);
      button.classList.toggle('stacked', open && Boolean(hopTrait(w)));
      button.disabled = !open || w.ammo <= 0 || remaining > 0;
      ammo.textContent = '×' + w.ammo;
      cooldown.textContent = !open ? '' : w.ammo <= 0 ? '탄약 없음' : remaining > 0 ? remaining.toFixed(1) + '초' : '준비';
      button.style.setProperty('--ready', String(1 - remaining / throwCooldown(w)));
    },
  };
}
