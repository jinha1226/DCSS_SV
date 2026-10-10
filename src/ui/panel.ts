/** One row of buttons of which exactly one is on. */
export interface Choice<T> {
  readonly title: string;
  readonly options: readonly { readonly value: T; readonly text: string }[];
  readonly get: () => T;
  readonly set: (value: T) => void;
}

export interface Panel {
  /** The line of text above the switches. */
  caption(text: string): void;
}

/** Adds one row of buttons to `bar` and returns what re-marks the one that is on. */
function addChoice<T>(bar: HTMLElement, choice: Choice<T>, refresh: () => void): () => void {
  const row = document.createElement('div');
  row.className = 'choice';
  const title = document.createElement('span');
  title.textContent = choice.title;
  row.append(title);
  const marks: (() => void)[] = [];
  for (const option of choice.options) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = option.text;
    button.addEventListener('click', () => {
      choice.set(option.value);
      refresh();
    });
    marks.push(() => button.classList.toggle('on', choice.get() === option.value));
    row.append(button);
  }
  bar.append(row);
  return () => marks.forEach((mark) => mark());
}

/** The strip at the top of the screen: a line of text and the switches being tried out. */
export function makePanel(root: HTMLElement, build: (add: <T>(choice: Choice<T>) => void) => void): Panel {
  const top = document.createElement('div');
  top.className = 'top';
  const caption = document.createElement('div');
  caption.className = 'caption';
  top.append(caption);
  const marks: (() => void)[] = [];
  const refresh = (): void => marks.forEach((mark) => mark());
  build((choice) => marks.push(addChoice(top, choice, refresh)));
  root.append(top);
  refresh();
  return {
    caption: (text) => {
      if (caption.textContent !== text) caption.textContent = text;
    },
  };
}
