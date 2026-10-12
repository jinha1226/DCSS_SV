export interface LayoutButton {
  readonly landscape: boolean;
}

/** Changes the UI layout without restarting the run or rotating the device. */
export function makeLayoutButton(root: HTMLElement): LayoutButton {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'layout-button';
  root.append(button);
  let landscape = false;
  try {
    landscape = localStorage.getItem('dcss-sv-layout') === 'landscape';
  } catch {
    // Browser storage is optional.
  }
  const draw = (): void => {
    root.dataset.layout = landscape ? 'landscape' : 'portrait';
    button.textContent = landscape ? '▯ 세로화면' : '▭ PC 가로화면';
    button.setAttribute('aria-label', 'PC 가로화면 모드');
    button.setAttribute('aria-pressed', String(landscape));
    button.title = landscape ? '세로화면 구성으로 전환' : '게임 왼쪽 · 상태와 미니맵 오른쪽';
  };
  button.addEventListener('click', () => {
    landscape = !landscape;
    draw();
    try {
      localStorage.setItem('dcss-sv-layout', landscape ? 'landscape' : 'portrait');
    } catch {
      // The current session still keeps its selection.
    }
  });
  draw();
  return {
    get landscape() {
      return landscape;
    },
  };
}
