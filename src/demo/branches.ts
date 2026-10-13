import '../styles/demo.css';
import '../styles/branches.css';
import { monsterKind, MONSTERS } from '../data/monsters';
import { PACKS } from '../data/packs';
import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import { guardZoom } from '../input/guards';
import { keyPush, watchKeys } from '../input/keys';
import { makeDungeonGraph, type Branch } from '../sim/dungeonGraph';
import type { World } from '../sim/types';
import { makeWorld, stepWorld, STEP } from '../sim/world';
import { loadAtlas, type Atlas } from '../view/atlas';
import { composeDoll, DOLL_CUT, dollLayers } from '../view/doll';
import { Fx } from '../view/fx';
import { LOOK, lookFor } from '../view/look';
import { drawWorld } from '../view/render';
import { makeDollWalk, type WalkSheet } from '../view/walk';
import { World3D } from '../view3d/world3d';

/**
 * Branch gallery: a real floor of each branch, made by the game's own generator and drawn by its own
 * renderers, to walk around and look at. Monsters stand where they were placed and never fight.
 */
const BRANCHES: readonly (readonly [Branch, string])[] = [
  ['Dungeon', '던전'],
  ['Lair', '짐승굴'],
  ['Orc', '오크 광산'],
  ['Temple', '사원'],
  ['Snake', '뱀 소굴'],
  ['Spider', '거미 둥지'],
  ['Swamp', '늪'],
  ['Shoals', '해안'],
  ['Vaults', '금고'],
  ['Zot', '조트의 영역'],
];
const LABEL = new Map<string, string>(BRANCHES);

/** Tiles that stand in for a DCSS original we may not reuse, and why. */
const STAND_INS: Readonly<Record<string, string>> = {
  Spider: '벽: DCSS 원본 거미 벽은 재사용 불가(작가 미확인) → 거미 돌벽으로 대체',
  Zot: '벽: DCSS처럼 파란 조트 벽을 노랗게 바꿔 만듦',
  Dungeon: '벽: DCSS 원본 짙은 벽돌은 재사용 불가 → 갈색 벽돌 유지',
  swamp_drake: '현행판은 재사용 불가 → 2010년판 그림',
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The first seed from `from` whose dungeon has `branch` (Snake/Spider and Swamp/Shoals depend on it). */
function seedWith(branch: Branch, from: number): number {
  for (let seed = from; ; seed++) if ([...makeDungeonGraph(seed).nodes.values()].some((n) => n.branch === branch)) return seed;
}

function firstFloor(seed: number, branch: Branch): number {
  const node = [...makeDungeonGraph(seed).nodes.values()].find((n) => n.branch === branch && n.floor === 1);
  return node?.id ?? 1;
}

function tileCanvas(atlas: Atlas, tile: TileName): HTMLCanvasElement {
  const c = element('canvas', 'branch-tile');
  c.width = c.height = TILE_SIZE;
  const at = tileRect(tile);
  const g = c.getContext('2d');
  if (g) {
    g.imageSmoothingEnabled = false;
    g.drawImage(atlas.image, at.x, at.y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  }
  return c;
}

function tileCard(atlas: Atlas, tile: TileName, caption?: string): HTMLElement {
  const card = element('figure', 'branch-card');
  card.append(tileCanvas(atlas, tile), element('figcaption', undefined, caption ?? tile));
  card.title = tile;
  return card;
}

/** Monster kinds the branch's packs bring, falling back to whoever stands on the floor. */
function rosterOf(branch: Branch, w: World): string[] {
  const kinds = new Set<string>();
  for (const pack of PACKS) if ((pack.branch ?? 'Dungeon') === branch) for (const m of pack.members) kinds.add(m.kind);
  if (kinds.size === 0) for (const m of w.monsters) kinds.add(m.kind.id);
  return [...kinds].filter((id) => MONSTERS.some((m) => m.id === id));
}

async function start(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#demo');
  if (!root) return;
  guardZoom(root);
  const atlas = await loadAtlas();
  const query = new URLSearchParams(location.search);

  const stage = element('div', 'demo-stage branch-stage');
  const canvas3d = element('canvas', 'branch-3d');
  const canvas = element('canvas', 'branch-2d');
  stage.append(canvas3d, canvas, element('p', 'demo-hint', 'WASD·방향키 또는 화면을 끌어서 걷기 · 계단을 밟으면 다음 층'));
  const panel = element('section', 'demo-panel branch-panel');
  const tabs = element('nav', 'branch-tabs');
  tabs.setAttribute('aria-label', '브랜치');
  const tools = element('div', 'branch-tools');
  const info = element('div', 'branch-info');
  panel.append(tabs, tools, info);
  root.append(stage, panel);

  const ctx = canvas.getContext('2d')!;
  let world3d: World3D | undefined;
  let mode: '3d' | '2d' = query.get('view') === '2d' ? '2d' : '3d';
  let reveal = true;
  let branch: Branch = (BRANCHES.find(([b]) => b === query.get('branch'))?.[0] ?? 'Lair') as Branch;
  let seed = 1;
  let world!: World;
  let fx = new Fx();
  let heroWalk: WalkSheet | undefined;
  let heroDoll = '';
  let shownDepth = -1;

  const showInfo = (): void => {
    shownDepth = world.depth;
    const node = world.dungeonGraph.nodes.get(world.depth);
    const here = node?.branch ?? 'Dungeon';
    const look = lookFor(here, LOOK.dcss);
    info.replaceChildren();
    info.append(element('h2', undefined, `${LABEL.get(here) ?? here} ${node?.floor ?? 1}층`));
    if (STAND_INS[here]) info.append(element('p', 'branch-note', STAND_INS[here]));
    const section = (title: string, cards: HTMLElement[]): void => {
      const grid = element('div', 'branch-grid');
      grid.append(...cards);
      info.append(element('h3', undefined, title), grid);
    };
    section(
      `바닥 ${look.floor.length}장`,
      look.floor.map((t) => tileCard(atlas, t)),
    );
    section(
      `벽 ${look.wall.length}장`,
      look.wall.map((t) => tileCard(atlas, t)),
    );
    section(
      '몬스터',
      rosterOf(here, world).map((id) => {
        const kind = monsterKind(id);
        const card = tileCard(atlas, kind.tile, `${kind.name} · ${kind.tile}`);
        if (STAND_INS[id]) card.append(element('small', 'branch-note', STAND_INS[id]));
        return card;
      }),
    );
  };

  const open = (next: Branch, from = 1): void => {
    branch = next;
    seed = seedWith(branch, from);
    world = makeWorld({ seed, depth: firstFloor(seed, branch), items: false });
    // The hero starts on the way back up; like after taking stairs, it must step off before they work.
    world.stairsArmed = false;
    fx = new Fx();
    world3d?.clearFloor();
    for (const tab of tabs.children) tab.classList.toggle('on', (tab as HTMLElement).dataset.branch === branch);
    const url = new URL(location.href);
    url.searchParams.set('branch', branch);
    history.replaceState(null, '', url);
    showInfo();
  };

  for (const [id, label] of BRANCHES) {
    const tab = element('button', 'branch-tab', label);
    tab.type = 'button';
    tab.dataset.branch = id;
    tab.addEventListener('click', () => open(id));
    tabs.append(tab);
  }
  const button = (label: string, act: (b: HTMLButtonElement) => void): HTMLButtonElement => {
    const b = element('button', 'demo-toggle', label);
    b.type = 'button';
    b.addEventListener('click', () => act(b));
    tools.append(b);
    return b;
  };
  button(mode === '3d' ? '3D 보기' : '2D 보기', (b) => {
    mode = mode === '3d' ? '2d' : '3d';
    b.textContent = mode === '3d' ? '3D 보기' : '2D 보기';
  });
  button('전체 공개', (b) => {
    reveal = !reveal;
    b.setAttribute('aria-pressed', String(reveal));
  }).setAttribute('aria-pressed', 'true');
  button('다시 생성', () => open(branch, seed + 1));

  // Walking: keys, or a drag anywhere on the picture used as a stick.
  const keys = watchKeys();
  let drag: { x: number; y: number; dx: number; dy: number } | undefined;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) Object.assign(drag, { dx: e.clientX - drag.x, dy: e.clientY - drag.y });
  });
  const release = (): void => {
    drag = undefined;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  const input = (): { mx: number; my: number } => {
    if (drag && Math.hypot(drag.dx, drag.dy) > 12) {
      const d = Math.hypot(drag.dx, drag.dy);
      return { mx: drag.dx / d, my: drag.dy / d };
    }
    const push = keyPush(keys);
    const d = Math.hypot(push.x, push.y) || 1;
    return { mx: push.x / d, my: push.y / d };
  };

  /** One step of the rules with the monsters lifted off the floor, so they stay put and leave the hero be. */
  const step = (): void => {
    const held = world.monsters.splice(0);
    stepWorld(world, input());
    world.monsters.push(...held);
    if (reveal) {
      world.seen.fill(1);
      world.visible.fill(1);
    }
    world3d?.take(world, world.events);
    fx.take(world.events);
    fx.step(STEP);
  };

  open(branch);
  let dpr = 1;
  let last = performance.now();
  let owed = 0;
  const frame = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    owed += dt;
    while (owed >= STEP) {
      owed -= STEP;
      step();
    }
    if (world.depth !== shownDepth) showInfo();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) Object.assign(canvas, { width, height });
    const cols = Math.max(11, Math.min(19, canvas.clientWidth / 34));
    canvas3d.hidden = mode !== '3d';
    if (mode === '3d') {
      if (!world3d) {
        world3d = new World3D(canvas3d, atlas, 'high', 'tiles', LOOK.dcss);
        // The default hero, as makeWorld makes it.
        void world3d.prepare('minotaur', 'berserker');
      }
      world3d.resize(width, height, dpr);
      world3d.render(world, { cols, dpr, stairProgress: world.descending }, fx, owed / STEP, dt, ctx);
    } else {
      const layers = dollLayers(world);
      if (layers.join('|') !== heroDoll || !heroWalk) {
        heroDoll = layers.join('|');
        heroWalk = makeDollWalk(composeDoll(atlas.image, layers), DOLL_CUT);
      }
      const look = lookFor(world.dungeonGraph.nodes.get(world.depth)?.branch, LOOK.dcss);
      drawWorld(ctx, atlas, world, { cols, look, dpr, heroWalk }, fx, owed / STEP);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
