import '../styles/demo.css';
import { heroFor } from '../data/hero';
import { schoolSpells, type SpellData } from '../data/spells';
import { skillData, SCHOOL_SKILLS } from '../data/skills';
import { guardZoom } from '../input/guards';
import { STEP } from '../sim/world';
import { loadAtlas, type Atlas } from '../view/atlas';
import { PALETTES, styleOf } from '../view/elementStyle';
import { Fx } from '../view/fx';
import { LOOK } from '../view/look';
import { cellPixels, drawWorld } from '../view/render';
import { makeWalk, type WalkSheet } from '../view/walk';
import { spellSummary, spellTags } from './describe';
import { castNow, chooseSpell, MAGE_JOBS, makeStage, setMoving, stepStage, type Stage, type StageOptions } from './stage';

/** Spell practice room: pick a school and a spell and watch it work on dummies, with the game's own rules and drawing. */
const SPEEDS = [0.25, 0.5, 1] as const;
const SCHOOL_LABELS: Readonly<Record<string, string>> = {
  fire: '화염',
  ice: '빙결',
  air: '대기',
  earth: '대지',
  summoning: '소환',
  hexes: '주술',
  necromancy: '강령',
};

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function toggle(label: string, on: boolean, change: (on: boolean) => void): HTMLButtonElement {
  const button = element('button', 'demo-toggle', label);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(on));
  button.addEventListener('click', () => {
    on = !on;
    button.setAttribute('aria-pressed', String(on));
    change(on);
  });
  return button;
}

async function start(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#demo');
  if (!root) return;
  guardZoom(root);
  const atlas: Atlas = await loadAtlas();

  const view = element('div', 'demo-stage');
  const canvas = element('canvas');
  view.append(canvas);
  const hint = element('p', 'demo-hint', '화면을 누르면 그 몬스터에게 시전합니다');
  view.append(hint);
  const panel = element('section', 'demo-panel');
  const schools = element('nav', 'demo-schools');
  schools.setAttribute('aria-label', '학파');
  const cards = element('div', 'demo-cards');
  const detail = element('div', 'demo-detail');
  const controls = element('div', 'demo-controls');
  panel.append(schools, cards, detail, controls);
  root.append(view, panel);

  const query = new URLSearchParams(location.search);
  // Dummies do not die by default: at school level 27 every spell kills in one hit. Marks need it off.
  const options: StageOptions = { moving: false, endless: true };
  let repeat = true;
  let speed: number = 1;
  let stage: Stage;
  let heroWalk: WalkSheet;
  let fx = new Fx();
  let sinceCast = 0;

  const castButton = element('button', 'demo-cast', '시전');
  castButton.type = 'button';
  castButton.addEventListener('click', () => {
    castNow(stage);
    sinceCast = 0;
  });
  const speedButton = element('button', 'demo-toggle', '속도 1×');
  speedButton.type = 'button';
  speedButton.addEventListener('click', () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length]!;
    speedButton.textContent = '속도 ' + speed + '×';
  });
  controls.append(
    castButton,
    toggle('반복 시전', repeat, (on) => (repeat = on)),
    toggle('허수아비 이동', options.moving, (on) => {
      options.moving = on;
      setMoving(stage, options);
    }),
    toggle('죽지 않음', options.endless, (on) => (options.endless = on)),
    speedButton,
  );

  const showDetail = (spell: SpellData): void => {
    detail.replaceChildren();
    const title = element('h2', undefined, spell.name);
    const tags = element('p', 'demo-tags');
    for (const tag of spellTags(spell)) tags.append(element('span', undefined, tag));
    detail.append(title, tags, element('p', 'demo-summary', spellSummary(spell)));
    castButton.disabled = spell.auto === true || !spell.enabled;
    castButton.textContent = spell.auto ? '지팡이가 저절로 쏩니다' : spell.enabled ? '시전' : '준비 중';
  };

  const pick = (spell: SpellData): void => {
    if (!spell.enabled) {
      showDetail(spell);
      return;
    }
    chooseSpell(stage, spell.id);
    for (const card of cards.children) card.classList.toggle('on', (card as HTMLElement).dataset.spell === spell.id);
    showDetail(spell);
    sinceCast = Infinity;
  };

  const openSchool = (school: string): void => {
    stage = makeStage(school, options);
    fx = new Fx();
    const hero = heroFor('deep_elf', MAGE_JOBS[school]!);
    heroWalk = makeWalk(atlas, hero.tile, hero.walk);
    for (const tab of schools.children) tab.classList.toggle('on', (tab as HTMLElement).dataset.school === school);
    cards.replaceChildren();
    for (const spell of schoolSpells(school)) {
      const card = element('button', 'demo-card' + (spell.enabled ? '' : ' off'));
      card.type = 'button';
      card.dataset.spell = spell.id;
      card.append(
        element('span', 'lv', String(spell.level)),
        element('strong', undefined, spell.name),
        element('small', undefined, spell.auto ? '자동' : spell.enabled ? '버튼' : '준비 중'),
      );
      card.addEventListener('click', () => pick(spell));
      cards.append(card);
    }
    const wanted = schoolSpells(school).find((spell) => spell.id === query.get('spell'));
    pick(wanted ?? schoolSpells(school).find((spell) => spell.enabled)!);
  };

  for (const school of SCHOOL_SKILLS) {
    const tab = element('button', 'demo-school', SCHOOL_LABELS[school] ?? skillData(school).name);
    tab.type = 'button';
    tab.dataset.school = school;
    tab.style.setProperty('--school', PALETTES[styleOf(schoolSpells(school)[0]!.id)].main);
    tab.addEventListener('click', () => openSchool(school));
    schools.append(tab);
  }
  // ?school=ice&spell=cold_fan opens straight on one spell, for sharing a link to a phone.
  const firstSchool = query.get('school') ?? '';
  openSchool((SCHOOL_SKILLS as readonly string[]).includes(firstSchool) ? firstSchool : 'fire');

  const ctx = canvas.getContext('2d', { alpha: false })!;
  let dpr = 1;
  let cols = 15;
  const fit = (): void => {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    // Wide screens show the whole room; narrow ones keep the cells large.
    cols = Math.max(13, Math.min(19, canvas.clientWidth / 30));
  };

  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const px = cellPixels(canvas.width, cols);
    const x = stage.world.hero.x + ((event.clientX - rect.left) * dpr - canvas.width / 2) / px;
    const y = stage.world.hero.y + ((event.clientY - rect.top) * dpr - canvas.height / 2) / px;
    if (castNow(stage, { x, y })) sinceCast = 0;
  });

  let last = performance.now();
  let owed = 0;
  const frame = (now: number): void => {
    owed += Math.min(0.1, (now - last) / 1000) * speed;
    last = now;
    while (owed >= STEP) {
      owed -= STEP;
      sinceCast += STEP;
      const every = Math.max(0.8, stage.spell.cooldown ?? 0, (stage.spell.duration ?? 0) * 0.8);
      if (repeat && !stage.spell.auto && sinceCast >= every) {
        castNow(stage);
        sinceCast = 0;
      }
      stepStage(stage, options);
      fx.take(stage.world.events);
      fx.step(STEP);
    }
    fit();
    drawWorld(ctx, atlas, stage.world, { cols, look: LOOK.dcss, dpr, heroWalk }, fx, owed / STEP);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void start();
