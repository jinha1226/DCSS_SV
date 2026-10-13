import { itemDefinition } from '../data/itemCatalog';
import { skillData } from '../data/skills';
import { TILE_SIZE, tileRect, type TileName } from '../data/tiles';
import { itemTile } from '../sim/identification';
import { chooseReward, skipReward } from '../sim/rewards';
import type { ItemChoice, World } from '../sim/types';
import type { Atlas } from '../view/atlas';

export interface SkillPicker {
  show(w: World): void;
}

/** Cards cannot be taken until they have been dealt and turned, so a tap meant for the game is not a choice. */
const READY_MS = 900;
/** How long the chosen card shines before the rules take the choice. */
const PICK_MS = 520;

/** Acquirement deals categories, not items, so each shows a typical piece of its kind. */
const CATEGORY_TILES: Partial<Record<ItemChoice['kind'], TileName>> = {
  armour: 'item/armour/chain_mail1' as TileName,
  jewellery: 'item/amulet/sapphire' as TileName,
  offhand: 'item/armour/shields/kite_shield1' as TileName,
};

function tileOf(w: World, card: ItemChoice): TileName | undefined {
  if (card.weapon) return card.weapon.tile;
  if (card.itemId) return (itemTile(w, card.itemId) ?? itemDefinition(card.itemId).tile) as TileName;
  if (card.kind === 'weapon') return w.weapon.tile;
  return CATEGORY_TILES[card.kind];
}

function icon(atlas: Atlas, tile: TileName | undefined): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'card-icon';
  c.width = c.height = TILE_SIZE;
  const g = c.getContext('2d');
  if (g && tile) {
    const at = tileRect(tile);
    g.imageSmoothingEnabled = false;
    g.drawImage(atlas.image, at.x, at.y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
  }
  return c;
}

/** The reward deal: cards fly in face down, turn over, lift under the finger, and the chosen one flares. */
export function makeSkillPicker(root: HTMLElement, atlas: Atlas): SkillPicker {
  const wrap = document.createElement('div');
  wrap.className = 'skill-picker reward-stage';
  root.append(wrap);
  const glow = document.createElement('div');
  glow.className = 'reward-rays';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'reward-eyebrow';
  const title = document.createElement('h2');
  title.textContent = '보상을 하나 고르세요';
  const cards = document.createElement('div');
  cards.className = 'skill-cards reward-cards';
  const skip = document.createElement('div');
  skip.className = 'reward-skip';
  const skipHeal = document.createElement('button');
  skipHeal.innerHTML = '<b>✚</b> 건너뛰고 회복';
  const skipGold = document.createElement('button');
  skipGold.innerHTML = '<b>◈</b> 건너뛰고 금화';
  for (const button of [skipHeal, skipGold]) button.type = 'button';
  skip.append(skipHeal, skipGold);
  const owned = document.createElement('div');
  owned.className = 'skill-owned';
  wrap.append(glow, eyebrow, title, cards, skip, owned);

  let key = '';
  let shownAt = 0;
  let picking = false;
  let current: World | undefined;
  const ready = (): boolean => !picking && performance.now() - shownAt >= READY_MS;

  const pick = (index: number): void => {
    const w = current;
    const card = w?.rewardChoices?.[index];
    if (!w || !card || !ready()) return;
    picking = true;
    const nodes = [...cards.querySelectorAll<HTMLElement>('.reward-card')];
    nodes.forEach((node, i) => node.classList.add(i === index ? 'picked' : 'dropped'));
    wrap.classList.add('resolving');
    window.setTimeout(() => {
      chooseReward(w, card.id);
      picking = false;
      wrap.classList.remove('resolving');
    }, PICK_MS);
  };

  const skipWith = (how: 'heal' | 'gold'): void => {
    if (current && ready()) skipReward(current, how);
  };
  skipHeal.addEventListener('click', () => skipWith('heal'));
  skipGold.addEventListener('click', () => skipWith('gold'));
  window.addEventListener('keydown', (event) => {
    if (!wrap.classList.contains('on')) return;
    const n = Number(event.key);
    if (n >= 1 && n <= 4) pick(n - 1);
  });

  const deal = (w: World, choices: readonly ItemChoice[]): void => {
    shownAt = performance.now();
    eyebrow.textContent = `레벨 ${w.hero.level} 획득`;
    title.textContent = '획득할 종류를 고르세요';
    cards.replaceChildren();
    choices.forEach((card, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `skill-card reward-card kind-${card.kind}`;
      button.style.setProperty('--i', String(i));
      button.disabled = true;
      const inner = document.createElement('div');
      inner.className = 'card-inner';
      const back = document.createElement('div');
      back.className = 'card-back';
      back.innerHTML = '<span>✦</span>';
      const face = document.createElement('div');
      face.className = 'card-face';
      const art = document.createElement('div');
      art.className = 'card-art';
      art.append(icon(atlas, tileOf(w, card)));
      const name = document.createElement('strong');
      name.textContent = card.name;
      const line = document.createElement('small');
      line.textContent = card.line;
      const hotkey = document.createElement('kbd');
      hotkey.textContent = String(i + 1);
      face.append(art, name, line, hotkey);
      inner.append(back, face);
      button.append(inner);
      button.addEventListener('click', () => pick(i));
      cards.append(button);
    });
  };

  return {
    show(w) {
      current = w;
      const choices = w.rewardChoices;
      wrap.classList.toggle('on', Boolean(choices));
      if (!choices) {
        key = '';
        return;
      }
      const nextKey = choices.map((c) => c.id).join('|');
      if (nextKey !== key) {
        key = nextKey;
        deal(w, choices);
      }
      const isReady = ready();
      skipHeal.disabled = skipGold.disabled = !isReady;
      for (const node of cards.querySelectorAll<HTMLButtonElement>('button')) node.disabled = !isReady;
      const list = Object.entries(w.hero.skills)
        .filter(([, level]) => level > 0)
        .map(([id, level]) => skillData(id).name + ' ' + level)
        .join(' · ');
      owned.textContent = list ? '현재 기술 · ' + list : '현재 기술 없음';
    },
  };
}
