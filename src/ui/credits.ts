/** Where the game's borrowed parts come from, as the menu's 크레딧 sheet shows them. */
const LINES: readonly (readonly [string, string])[] = [
  [
    '게임 코드',
    'GPL-3.0-or-later. Dungeon Crawl Stone Soup(GPL-2.0-or-later)의 규칙과 설명문을 바탕으로 만들었습니다. DCSS 개발팀이 만든 게임은 아닙니다.',
  ],
  ['타일 그림', 'Dungeon Crawl Stone Soup 타일 작가들 (CC0)'],
  ['3D 모델', 'KayKit · Kay Lousberg, Quaternius (CC0)'],
  ['3D 렌더링', 'three.js (MIT)'],
  ['글꼴', '나눔고딕코딩, 고운바탕 (SIL Open Font License)'],
];

/** The credits sheet: a list over the game, closed by its button, a tap outside it, or Escape. */
export function makeCredits(root: HTMLElement): { open(): void } {
  const backdrop = document.createElement('div');
  backdrop.className = 'credits-backdrop';
  backdrop.hidden = true;
  const sheet = document.createElement('section');
  sheet.className = 'credits-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', '크레딧');
  const title = document.createElement('h2');
  title.textContent = '크레딧';
  const list = document.createElement('dl');
  for (const [term, text] of LINES) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = text;
    list.append(dt, dd);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'credits-close';
  close.textContent = '닫기';
  sheet.append(title, list, close);
  backdrop.append(sheet);
  root.append(backdrop);

  const hide = (): void => {
    backdrop.hidden = true;
  };
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !backdrop.hidden) hide();
  });
  return {
    open() {
      backdrop.hidden = false;
    },
  };
}
