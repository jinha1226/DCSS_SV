/** One row of buttons of which exactly one is on. */
export interface Choice<T> {
  readonly title: string;
  readonly options: readonly { readonly value: T; readonly text: string }[];
  readonly get: () => T;
  readonly set: (value: T) => void;
}

export interface Panel {
  /** The line at the top of the screen. */
  caption(text: string): void;
  /** Marks the buttons that are on, after a value changed. */
  refresh(): void;
}

/** The strip of switches at the bottom of the screen and the line of text at the top. */
export function makePanel(root: HTMLElement, choices: readonly Choice<unknown>[]): Panel {
  const top = document.createElement('div');
  top.className = 'caption';
  const bar = document.createElement('div');
  bar.className = 'bar';
  const marks: (() => void)[] = [];

  for (const choice of choices) {
    const row = document.createElement('div');
    row.className = 'choice';
    const title = document.createElement('span');
    title.textContent = choice.title;
    row.append(title);
    for (const option of choice.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.text;
      button.addEventListener('click', () => {
        choice.set(option.value);
        for (const mark of marks) mark();
      });
      marks.push(() => button.classList.toggle('on', choice.get() === option.value));
      row.append(button);
    }
    bar.append(row);
  }
  root.append(top, bar);
  const refresh = (): void => {
    for (const mark of marks) mark();
  };
  refresh();
  return { caption: (text) => (top.textContent = text), refresh };
}
