import { skillData } from '../data/skills';
import type { SimEvent, World } from '../sim/world';

export type LogTone = 'normal' | 'warning' | 'good' | 'system';
export interface LogLine {
  readonly text: string;
  readonly tone: LogTone;
  readonly time: number;
  count: number;
}

const LIMIT = 80;
const MERGE_SECONDS = 2;

export function eventMessages(events: readonly SimEvent[]): { text: string; tone: LogTone }[] {
  const messages: { text: string; tone: LogTone }[] = [];
  const killed = new Map<string, number>();
  const woke = new Set<string>();
  let hurt = 0;
  let dodged = false;
  let blocked = false;
  let floor: number | undefined;
  for (const event of events) {
    if (event.type === 'kill') {
      const name = event.name ?? '적';
      killed.set(name, (killed.get(name) ?? 0) + 1);
    } else if (event.type === 'wake' && event.name) {
      woke.add(event.name);
    } else if (event.type === 'hurt') {
      hurt += event.amount;
    } else if (event.type === 'elemental' && event.target === 'hero') {
      hurt += event.amount;
    } else if (event.type === 'dodge') {
      dodged = true;
    } else if (event.type === 'block') {
      blocked = true;
    } else if (event.type === 'floor') {
      floor = event.depth;
    }
  }
  for (const name of woke) messages.push({ text: name + '이(가) 당신을 알아챘다.', tone: 'warning' });
  for (const [name, count] of killed)
    messages.push({ text: count > 1 ? name + ' ' + count + '마리를 쓰러뜨렸다.' : name + '을(를) 쓰러뜨렸다.', tone: 'normal' });
  if (hurt > 0) messages.push({ text: '공격에 맞아 체력 ' + Math.round(hurt) + '을(를) 잃었다.', tone: 'warning' });
  if (dodged) messages.push({ text: '재빨리 몸을 피했다.', tone: 'good' });
  if (blocked) messages.push({ text: '공격을 막아냈다.', tone: 'good' });
  if (floor !== undefined) messages.push({ text: '던전 ' + floor + '층에 들어섰다.', tone: 'system' });
  return messages;
}

export interface GameLog {
  readonly expanded: boolean;
  reset(w: World): void;
  take(w: World): void;
  show(w: World): void;
  hide(): void;
}

export function makeGameLog(root: HTMLElement): GameLog {
  const log = document.createElement('section');
  log.className = 'game-log';
  log.setAttribute('aria-label', '게임 메시지');
  const peek = document.createElement('button');
  peek.type = 'button';
  peek.className = 'game-log-peek';
  peek.setAttribute('aria-label', '게임 로그 펼치기');
  log.append(peek);
  root.append(log);

  const shade = document.createElement('button');
  shade.type = 'button';
  shade.className = 'game-log-shade';
  shade.setAttribute('aria-label', '게임 로그 닫기');
  root.append(shade);
  const panel = document.createElement('section');
  panel.className = 'game-log-panel';
  const heading = document.createElement('div');
  heading.className = 'game-log-header';
  heading.textContent = '메시지 기록';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '닫기 ×';
  heading.append(close);
  const history = document.createElement('div');
  history.className = 'game-log-history';
  panel.append(heading, history);
  root.append(panel);

  let current: World | undefined;
  let lines: LogLine[] = [];
  let opened = false;
  let lastLevel = 0;
  let lastWeapon = '';
  let lastSkills = new Map<string, number>();
  let shownKey = '';

  const setOpen = (value: boolean): void => {
    opened = value;
    shade.classList.toggle('on', value);
    panel.classList.toggle('on', value);
    if (value) shownKey = '';
  };
  peek.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  shade.addEventListener('click', () => setOpen(false));

  const add = (text: string, tone: LogTone, time: number): void => {
    const last = lines.at(-1);
    if (last && last.text === text && time - last.time < MERGE_SECONDS) {
      last.count++;
      lines[lines.length - 1] = { ...last, time };
    } else {
      lines.push({ text, tone, time, count: 1 });
      if (lines.length > LIMIT) lines.shift();
    }
    shownKey = '';
  };
  const item = (line: LogLine): HTMLDivElement => {
    const node = document.createElement('div');
    node.className = 'game-log-line ' + line.tone;
    node.textContent = line.text + (line.count > 1 ? ' ×' + line.count : '');
    return node;
  };
  const observe = (w: World): void => {
    if (current !== w) return;
    if (w.hero.level > lastLevel) add('경험이 쌓였다. 레벨 ' + w.hero.level + '!', 'good', w.time);
    lastLevel = w.hero.level;
    if (w.weapon.uid !== lastWeapon) {
      add(w.weapon.name + '을(를) 장착했다.', 'system', w.time);
      lastWeapon = w.weapon.uid;
    }
    for (const [id, level] of Object.entries(w.hero.skills)) {
      if (level > (lastSkills.get(id) ?? 0)) {
        add(skillData(id).name + ' 숙련도가 ' + level + '단계가 되었다.', 'good', w.time);
      }
    }
    lastSkills = new Map(Object.entries(w.hero.skills));
  };

  return {
    get expanded() {
      return opened;
    },
    reset(w) {
      current = w;
      lines = [];
      lastLevel = w.hero.level;
      lastWeapon = w.weapon.uid;
      lastSkills = new Map(Object.entries(w.hero.skills));
      shownKey = '';
      setOpen(false);
      log.classList.add('on');
      add('던전 ' + w.depth + '층에 들어섰다. 주변을 살펴보자.', 'system', w.time);
    },
    take(w) {
      if (w !== current) return;
      for (const message of eventMessages(w.events)) add(message.text, message.tone, w.time);
      observe(w);
    },
    show(w) {
      if (w !== current) return;
      observe(w);
      log.classList.toggle('on', !w.over);
      if (w.over && opened) setOpen(false);
      const key = lines.map((line) => line.text + ':' + line.count).join('|');
      if (key === shownKey) return;
      shownKey = key;
      peek.replaceChildren(...lines.slice(-2).map(item));
      if (opened) {
        history.replaceChildren(...lines.map(item));
        history.scrollTop = history.scrollHeight;
      }
    },
    hide() {
      current = undefined;
      log.classList.remove('on');
      setOpen(false);
    },
  };
}
