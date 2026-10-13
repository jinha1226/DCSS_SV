import { effectLines, itemLore } from '../data/itemLore';
import { brandData } from '../data/items';
import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import { CONSUMABLES, dropConsumable, useConsumable, type ConsumableId } from '../sim/consumables';
import { dropStoredWeapon, equipStoredWeapon, weaponOption, weaponScore } from '../sim/equipment';
import { dropGear, equipGear, gearBonus, unequipGear, type GearSlot } from '../sim/gear';
import { itemDisplayName } from '../sim/identification';
import type { World } from '../sim/world';
import type { Atlas } from '../view/atlas';
import { bagGroups, equipmentRows, overviewColumns, resistPips, skillRows, type ItemRow, type Pair } from './ledgerData';
import { makeSpellSlotPanel } from './spellSlotPanel';
import { statusValues } from './statusSheet';

export type LedgerTab = 'status' | 'skills' | 'items';

export interface Ledger {
  readonly open: boolean;
  show(w: World): void;
  openTab(tab: LedgerTab): void;
  close(): void;
}

const TABS: readonly { id: LedgerTab; key: string; label: string }[] = [
  { id: 'status', key: '@', label: '상태' },
  { id: 'skills', key: 'm', label: '기술' },
  { id: 'items', key: 'i', label: '가방' },
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function tileCanvas(atlas: Atlas, tile: TileName | undefined, className: string): HTMLCanvasElement {
  const c = el('canvas', className);
  c.width = c.height = TILE_SIZE;
  const g = c.getContext('2d');
  if (g && tile) {
    const at = tileRect(tile);
    g.imageSmoothingEnabled = false;
    g.drawImage(atlas.image, at.x, at.y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  }
  return c;
}

function pair(p: Pair): HTMLElement {
  const row = el('div', 'lg-pair');
  row.append(el('span', 'lg-label', p.label), el('b', 'tone-' + p.tone, p.value));
  return row;
}

interface Move {
  readonly key: string;
  readonly label: string;
  readonly run: () => string;
}

/**
 * The DCSS-style character ledger: the % overview, the m skill list and the i inventory on one sheet.
 * Wide screens show all three side by side; phones show one at a time behind tabs. Items are picked by
 * letter or touch, and the chosen item's description lists what can be done with it, keyed like DCSS.
 */
export function makeLedger(root: HTMLElement, atlas: Atlas, canOpen: () => boolean): Ledger {
  const shade = el('button', 'ledger-shade');
  shade.type = 'button';
  shade.setAttribute('aria-label', '기록부 닫기');
  const sheet = el('section', 'ledger');
  sheet.setAttribute('aria-label', '캐릭터 기록부');
  const head = el('header', 'lg-head');
  const titleWrap = el('div', 'lg-title');
  const title = el('strong');
  const subtitle = el('span');
  titleWrap.append(title, subtitle);
  const clock = el('span', 'lg-clock');
  const close = el('button', 'lg-close', 'Esc 닫기');
  close.type = 'button';
  head.append(titleWrap, clock, close);
  const tabs = el('nav', 'lg-tabs');
  const tabButtons = TABS.map((t) => {
    const b = el('button', 'lg-tab');
    b.type = 'button';
    b.dataset.tab = t.id;
    b.append(el('kbd', '', t.key), document.createTextNode(' ' + t.label));
    b.addEventListener('click', () => setTab(t.id));
    tabs.append(b);
    return b;
  });
  const body = el('div', 'lg-body');
  const colStatus = el('section', 'lg-col lg-status');
  const colSkills = el('section', 'lg-col lg-skills');
  const colItems = el('section', 'lg-col lg-items');
  body.append(colStatus, colSkills, colItems);
  const detail = el('footer', 'lg-detail');
  sheet.append(head, tabs, body, detail);
  root.append(shade, sheet);
  const spellPanel = makeSpellSlotPanel();

  let world: World | undefined;
  let opened = false;
  let tab: LedgerTab = 'status';
  let selected = '';
  let message = '';
  let identifying = false;
  let lastKey = '';

  const setOpen = (value: boolean): void => {
    opened = value;
    sheet.classList.toggle('on', value);
    shade.classList.toggle('on', value);
    if (!value) {
      selected = '';
      identifying = false;
    }
    lastKey = '';
  };
  const setTab = (value: LedgerTab): void => {
    tab = value;
    lastKey = '';
    if (world) render(world);
  };
  const select = (key: string): void => {
    selected = selected === key ? '' : key;
    identifying = false;
    lastKey = '';
    if (world) render(world);
  };
  const after = (text: string): void => {
    message = text;
    lastKey = '';
    if (world) render(world);
  };
  shade.addEventListener('click', () => setOpen(false));
  close.addEventListener('click', () => setOpen(false));

  const itemLine = (row: ItemRow, extra = ''): HTMLElement => {
    const line = el('button', 'lg-item tone-' + row.tone + (row.key === selected ? ' selected' : ''));
    line.type = 'button';
    line.append(el('span', 'lg-letter', row.letter + ')'));
    line.append(tileCanvas(atlas, row.tile, 'lg-icon'));
    if (extra) line.append(el('span', 'lg-slot', extra));
    line.append(el('span', 'lg-name', row.name));
    if (row.note) line.append(el('span', 'lg-note', row.note));
    line.addEventListener('click', () => select(row.key));
    return line;
  };

  const renderStatus = (w: World): void => {
    colStatus.replaceChildren();
    const hero = el('div', 'lg-hero');
    hero.append(tileCanvas(atlas, w.heroDef.tile, 'lg-portrait'));
    const who = el('div');
    who.append(el('b', 'tone-hi', w.heroDef.name), el('small', 'tone-muted', `레벨 ${w.hero.level} · 처치 ${w.kills}`));
    hero.append(who);
    colStatus.append(hero);
    const grid = el('div', 'lg-overview');
    for (const column of overviewColumns(w)) {
      const c = el('div');
      for (const p of column) c.append(pair(p));
      grid.append(c);
    }
    colStatus.append(grid, el('h3', '', '저항'));
    const resists = el('div', 'lg-resists');
    for (const r of resistPips(w)) {
      const row = el('div', 'lg-pair');
      const pips = el('b', 'lg-pips');
      for (const ch of r.pips.split(' ')) pips.append(el('span', ch === '+' ? 'tone-good' : ch === 'x' ? 'tone-bad' : 'tone-muted', ch));
      row.append(el('span', 'lg-label', r.label), pips);
      resists.append(row);
    }
    colStatus.append(resists, el('h3', '', '장비'));
    const gear = el('div', 'lg-list');
    for (const row of equipmentRows(w)) {
      const line = itemLine(row, row.slot);
      if (!row.available) line.classList.add('unavailable');
      gear.append(line);
    }
    const effects = el('div', 'lg-effects');
    for (const [label, id] of [
      ['방어', 'armour'],
      ['방패', 'shield'],
      ['화염', 'fire_resist'],
      ['냉기', 'cold_resist'],
    ] as const) {
      const n = gearBonus(w, id);
      effects.append(pair({ label, value: (n >= 0 ? '+' : '') + n, tone: n > 0 ? 'good' : n < 0 ? 'bad' : 'muted' }));
    }
    colStatus.append(gear, effects, el('h3', '', '능력'));
    const extra = el('div', 'lg-extra');
    for (const v of statusValues(w).extra) extra.append(pair({ label: v.label, value: v.value, tone: 'plain' }));
    extra.append(
      pair({ label: '룬', value: `${w.runes.size}/2`, tone: w.runes.size ? 'magic' : 'muted' }),
      pair({ label: '조트의 보주', value: w.orbCollected ? '획득' : '—', tone: w.orbCollected ? 'gold' : 'muted' }),
    );
    colStatus.append(extra);
  };

  const renderSkills = (w: World): void => {
    colSkills.replaceChildren(el('h3', '', '기술'));
    const head = el('div', 'lg-skill lg-skill-head');
    head.append(el('span', '', ''), el('span', '', '이름'), el('span', '', '단계'), el('span', '', '진행'));
    const list = el('div', 'lg-list');
    list.append(head);
    for (const s of skillRows(w)) {
      const row = el('div', 'lg-skill' + (s.training ? ' training' : ''));
      row.title = s.description;
      row.append(
        el('span', 'lg-letter', s.letter + (s.training ? ' +' : ' -')),
        el('span', s.training ? 'tone-hi' : 'tone-plain', s.name),
        el('b', s.level > 0 ? 'tone-good' : 'tone-muted', String(s.level)),
        el('span', 'tone-muted', s.percent + '%'),
      );
      list.append(row);
    }
    colSkills.append(list, el('p', 'lg-hint', '+ 표시는 지금 쓰는 장비로 훈련 중인 기술입니다.'));
    spellPanel.render(w);
    colSkills.append(spellPanel.element);
  };

  const renderItems = (w: World): void => {
    colItems.replaceChildren();
    const groups = bagGroups(w);
    for (const g of groups) {
      colItems.append(el('h3', '', g.title));
      const list = el('div', 'lg-list');
      for (const row of g.rows) list.append(itemLine(row));
      colItems.append(list);
    }
    if (!groups.length) colItems.append(el('p', 'lg-hint', '가방이 비어 있습니다.'));
    const gold = el('p', 'lg-gold');
    gold.append(el('span', 'tone-muted', '금화 '), el('b', 'tone-gold', String(w.gold)));
    colItems.append(gold);
  };

  /** What the chosen item is and what can be done with it, as [key] action pairs. */
  const describe = (w: World): { lines: string[]; moves: Move[]; name: string; tile?: TileName; lore?: string } | undefined => {
    if (!selected) return undefined;
    const weaponLines = (weapon: World['weapon']): string[] => {
      const damage = weapon.damage + (weapon.enchantment ?? 0) + weaponOption(weapon, 'damage');
      return [
        `피해 ${damage} · 공격 간격 ${weapon.every.toFixed(2)}초 · ${weapon.hands === 2 ? '양손' : '한손'}`,
        `속성 ${brandData(weapon.brand)?.name ?? '없음'}${weapon.special ? ' · 아티팩트' : ''}`,
      ];
    };
    const loreOf = (id: string | undefined): { lore?: string } => {
      const lore = id ? itemLore(id) : undefined;
      return lore ? { lore } : {};
    };
    if (selected === 'slot:weapon' || selected === w.weapon.uid) {
      return {
        name: w.weapon.name,
        tile: w.weapon.tile,
        lines: [...weaponLines(w.weapon), '지금 들고 있는 무기입니다.'],
        moves: [],
        ...loreOf(w.weapon.baseId),
      };
    }
    if (selected.startsWith('slot:') || selected === 'offhand-equipped') {
      const slot = (selected === 'offhand-equipped' ? 'offhand' : selected.slice(5)) as GearSlot;
      const worn = w.gear[slot];
      const row = equipmentRows(w).find((r) => r.key === 'slot:' + slot);
      if (!worn || !row) return { name: row?.slot ?? '빈 칸', lines: ['비어 있는 칸입니다.'], moves: [] };
      return {
        name: row.name,
        ...(row.tile ? { tile: row.tile } : {}),
        lines: [...effectLines(worn), `${row.slot}에 착용 중${w.cursedGear.has(worn) ? ' · 저주받음' : ''}`],
        ...loreOf(worn),
        moves: [
          { key: 'r', label: '벗기', run: () => (unequipGear(w, slot) ? '장비를 벗었습니다.' : '저주받은 장비는 벗을 수 없습니다.') },
        ],
      };
    }
    const stored = w.inventory.find((item) => item.uid === selected);
    const row = bagGroups(w)
      .flatMap((g) => g.rows)
      .find((r) => r.key === selected);
    if (!stored || !row) return row ? { name: row.name, ...(row.tile ? { tile: row.tile } : {}), lines: [], moves: [] } : undefined;
    const base = { name: row.name, ...(row.tile ? { tile: row.tile } : {}) };
    if (stored.kind === 'weapon') {
      const compared = weaponScore(stored.weapon) - weaponScore(w.weapon);
      return {
        ...base,
        lines: [...weaponLines(stored.weapon), `지금 무기보다 ${compared >= 0 ? '+' : ''}${compared.toFixed(1)}`],
        ...loreOf(stored.weapon.baseId),
        moves: [
          { key: 'e', label: '장착', run: () => (equipStoredWeapon(w, stored.uid), (selected = ''), '무기를 바꿔 들었습니다.') },
          { key: 'd', label: '버리기', run: () => (dropStoredWeapon(w, stored.uid), (selected = ''), '무기를 버렸습니다.') },
        ],
      };
    }
    if (stored.kind === 'gear') {
      return {
        ...base,
        lines: [...effectLines(stored.id), '장비 · 착용하면 효과가 납니다.'],
        ...loreOf(stored.id),
        moves: [
          {
            key: 'e',
            label: '착용',
            run: () =>
              equipGear(w, stored.uid) ? ((selected = ''), '장비를 착용했습니다.') : '착용할 수 없습니다. 양손 무기나 저주를 확인하세요.',
          },
          {
            key: 'd',
            label: '버리기',
            run: () => (dropGear(w, stored.uid) ? ((selected = ''), '장비를 버렸습니다.') : '버릴 수 없습니다.'),
          },
        ],
      };
    }
    const config = CONSUMABLES[stored.id as ConsumableId];
    const moves: Move[] = [];
    if (config) {
      moves.push({
        key: 'q',
        label: config.action,
        run: () => {
          if (stored.id === 'scroll_identify') {
            identifying = true;
            return '감정할 아이템을 고르세요.';
          }
          return useConsumable(w, stored.id as ConsumableId)
            ? itemDisplayName(w, stored.id) + '을(를) 사용했습니다.'
            : '지금은 사용할 수 없습니다.';
        },
      });
    }
    moves.push({
      key: 'd',
      label: '버리기',
      run: () =>
        dropConsumable(w, stored.id as ConsumableId) ? itemDisplayName(w, stored.id) + ' 1개를 버렸습니다.' : '버릴 수 없습니다.',
    });
    if (!w.identifiedItems.has(stored.id)) {
      const unknown = '아직 감정하지 않았다. 써 보거나 감정 두루마리로 정체를 밝힐 수 있다.';
      return { ...base, lines: [`소모품 · ${stored.count}개 · 미감정`], moves, lore: unknown };
    }
    return { ...base, lines: [...effectLines(stored.id), `소모품 · ${stored.count}개`], moves, ...loreOf(stored.id) };
  };

  const renderDetail = (w: World): void => {
    detail.replaceChildren();
    const info = describe(w);
    if (info) {
      const card = el('div', 'lg-desc');
      card.append(tileCanvas(atlas, info.tile, 'lg-desc-icon'));
      const text = el('div');
      text.append(el('b', 'tone-hi', info.name));
      if (info.lore) text.append(el('p', 'lg-lore', info.lore));
      for (const line of info.lines) text.append(el('p', '', line));
      card.append(text);
      const actions = el('div', 'lg-actions');
      for (const move of info.moves) {
        const b = el('button', 'lg-action');
        b.type = 'button';
        b.append(el('kbd', '', move.key), document.createTextNode(' ' + move.label));
        b.addEventListener('click', () => after(move.run()));
        actions.append(b);
      }
      if (identifying) {
        const targets = w.inventory.filter((e) => e.kind === 'consumable' && e.id !== 'scroll_identify' && !w.identifiedItems.has(e.id));
        if (!targets.length) actions.append(el('span', 'tone-muted', '감정할 아이템이 없습니다.'));
        for (const t of targets) {
          if (t.kind !== 'consumable') continue;
          const b = el('button', 'lg-action');
          b.type = 'button';
          b.textContent = itemDisplayName(w, t.id);
          b.addEventListener('click', () => {
            identifying = false;
            after(useConsumable(w, 'scroll_identify', t.id) ? '감정 완료: ' + itemDisplayName(w, t.id) : '감정할 수 없습니다.');
          });
          actions.append(b);
        }
      }
      card.append(actions);
      detail.append(card);
    } else {
      detail.append(el('p', 'lg-hint', '항목을 누르거나 글자 키로 고르면 설명과 할 수 있는 일이 여기에 나옵니다.'));
    }
    if (message) detail.append(el('p', 'lg-message', message));
  };

  const keyOf = (w: World): string =>
    [
      tab,
      selected,
      message,
      identifying,
      Math.ceil(w.hero.hp),
      Math.floor(w.hero.mana),
      w.hero.level,
      Math.floor(w.hero.xp),
      w.kills,
      w.gold,
      w.weapon.uid,
      JSON.stringify(w.gear),
      JSON.stringify(w.hero.skills),
      Object.values(w.hero.skillXp)
        .map((v) => Math.floor(v))
        .join(','),
      w.inventory.map((i) => i.uid + (i.kind === 'consumable' ? ':' + i.count : '')).join(','),
      [...w.identifiedItems].join(','),
      [...w.cursedGear].join(','),
      w.runes.size,
      spellPanel.key(w),
      Math.floor(w.time),
    ].join('|');

  const render = (w: World): void => {
    const key = keyOf(w);
    if (key === lastKey) return;
    lastKey = key;
    sheet.dataset.tab = tab;
    for (const b of tabButtons) b.classList.toggle('on', b.dataset.tab === tab);
    const node = w.dungeonGraph.nodes.get(w.depth);
    title.textContent = w.heroDef.name;
    subtitle.textContent = node ? `${node.branch === 'Dungeon' ? '지하' : node.branch} ${node.floor}층` : `${w.depth}층`;
    clock.textContent = `시간 ${Math.floor(w.time / 60)}:${String(Math.floor(w.time % 60)).padStart(2, '0')}`;
    renderStatus(w);
    renderSkills(w);
    renderItems(w);
    renderDetail(w);
  };

  /** Letter keys pick from the visible list; with something picked, its action keys act. */
  const onKey = (event: KeyboardEvent): void => {
    const w = world;
    if (!w) return;
    if (!opened) {
      if (!canOpen() || event.ctrlKey || event.metaKey || event.altKey) return;
      const t = event.key === 'i' ? 'items' : event.key === 'm' ? 'skills' : event.key === '%' || event.key === '@' ? 'status' : undefined;
      if (!t) return;
      event.preventDefault();
      api.openTab(t);
      return;
    }
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (selected || identifying) select('');
      else setOpen(false);
      return;
    }
    const jump = event.key === 'i' ? 'items' : event.key === 'm' ? 'skills' : event.key === '%' || event.key === '@' ? 'status' : undefined;
    if (jump && !selected) {
      event.preventDefault();
      setTab(jump);
      return;
    }
    const info = describe(w);
    const move = info?.moves.find((m) => m.key === event.key);
    if (move) {
      event.preventDefault();
      after(move.run());
      return;
    }
    const rows = tab === 'status' ? equipmentRows(w) : bagGroups(w).flatMap((g) => g.rows);
    const hit = rows.find((r) => r.letter === event.key);
    if (hit) {
      event.preventDefault();
      select(hit.key);
    }
  };
  window.addEventListener('keydown', onKey, true);

  const api: Ledger = {
    get open() {
      return opened;
    },
    show(w) {
      world = w;
      if (w.over && opened) setOpen(false);
      if (opened) render(w);
    },
    openTab(t) {
      if (!world || world.over) return;
      message = '';
      setOpen(true);
      setTab(t);
    },
    close() {
      setOpen(false);
    },
  };
  return api;
}
