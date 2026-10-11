export interface TimeModeButton {
  readonly superhot: boolean;
}

export function makeTimeModeButton(root: HTMLElement): TimeModeButton {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'time-mode';
  root.append(button);

  let superhot = false;
  const draw = (): void => {
    button.classList.toggle('on', superhot);
    button.textContent = superhot ? 'SUPERHOT' : '실시간';
  };

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    superhot = !superhot;
    draw();
  });

  draw();

  return {
    get superhot() {
      return superhot;
    },
  };
}
