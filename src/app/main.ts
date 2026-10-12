import '../styles/main.css';
import { CHARACTERS } from '../data/characters';
import { heroFor } from '../data/hero';
import { spellData } from '../data/spells';
import { guardZoom } from '../input/guards';
import { keyPush, watchKeys } from '../input/keys';
import { makeStick } from '../input/stick';
import { spellAtPoint, spellTarget } from '../sim/spells';
import { shopAccessible } from '../sim/branchLoot';
import { STEP, makeWorld, stepWorld, type Input, type World } from '../sim/world';
import { makeCharacterSelect, type CharacterChoice } from '../ui/characterSelect';
import { makeEquipmentPicker } from '../ui/equipmentPicker';
import { makeGameLog } from '../ui/gameLog';
import { makeHud } from '../ui/hud';
import { makeInventorySheets } from '../ui/inventorySheets';
import { makeHopButton } from '../ui/hopButton';
import { makeSkillBar } from '../ui/skillBar';
import { makeSkillPicker } from '../ui/skillPicker';
import { makeStatusSheet } from '../ui/statusSheet';
import { makeSpellButtons } from '../ui/spellButtons';
import { makeThrowButton } from '../ui/throwButton';
import { makeTimeModeButton } from '../ui/timeModeButton';
import { loadAtlas } from '../view/atlas';
import { Fx } from '../view/fx';
import { LOOK } from '../view/look';
import { drawMiniMap } from '../view/minimap';
import { cellPixels, drawWorld } from '../view/render';
import { makeWalk, type WalkSheet } from '../view/walk';
import { runLoop } from './loop';
import { stairHoldActive } from './stairInput';
import { readSwitches } from './switches';

async function start(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) return;
  guardZoom(root);

  const canvas = document.createElement('canvas');
  root.append(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const switches = readSwitches(location.search);
  const atlas = await loadAtlas();
  const stick = makeStick(canvas, root);
  const keys = watchKeys();
  const fx = new Fx();
  const hop = makeHopButton(root);
  const throwing = makeThrowButton(root);
  const picker = makeSkillPicker(root);
  const gear = makeEquipmentPicker(root);
  const spellButtons = makeSpellButtons(root);

  let selected: CharacterChoice | undefined;
  let world: World | undefined;
  let heroWalk: WalkSheet | undefined;
  let dpr = 1;
  let queuedSpell: Input['spell'];

  const begin = (character: CharacterChoice): void => {
    selected = character;
    const hero = heroFor(character.species, character.job);
    heroWalk = makeWalk(atlas, hero.tile, hero.walk);
    world = makeWorld({
      species: character.species,
      job: character.job,
      seed: switches.seed || Date.now() & 0x7fffffff,
      speed: switches.speed,
      depth: switches.floor,
    });
    fx.clear();
    gameLog.reset(world);
    skillBar.close();
    inventory.close();
    statusSheet.close();
    spellButtons.cancelTarget();
    selector.hide();
    if (debug) debug.world = world;
  };

  const chooseCharacter = (): void => {
    world = undefined;
    gameLog.hide();
    skillBar.close();
    inventory.close();
    statusSheet.close();
    selected = undefined;
    spellButtons.cancelTarget();
    selector.show();
  };

  const selector = makeCharacterSelect(root, atlas, begin);
  const debug: { world?: World } | undefined = switches.debug ? {} : undefined;
  if (debug) Object.assign(window, { __sv: Object.assign(debug, { switches, stick, keys }) });

  const hud = makeHud(
    root,
    () => {
      if (selected) begin(selected);
    },
    chooseCharacter,
  );
  const inventory = makeInventorySheets(root);
  const shopButton = document.createElement('button');
  shopButton.type = 'button';
  shopButton.className = 'inventory-action';
  shopButton.style.position = 'fixed';
  shopButton.style.zIndex = '14';
  shopButton.style.left = '50%';
  shopButton.style.bottom = 'calc(148px + env(safe-area-inset-bottom, 0px))';
  shopButton.style.transform = 'translateX(-50%)';
  shopButton.style.minHeight = '44px';
  shopButton.style.padding = '9px 18px';
  shopButton.textContent = '◈ 상점 열기';
  shopButton.hidden = true;
  shopButton.addEventListener('click', () => {
    if (!world || !shopAccessible(world)) return;
    hud.closeMenu();
    inventory.openSheet('shop');
  });
  root.append(shopButton);
  const statusSheet = makeStatusSheet(root);
  const skillBar = makeSkillBar(hud.skillSlot, atlas, () => {
    skillBar.close();
    inventory.openSheet('equipment');
  });
  const timeMode = makeTimeModeButton(hud.menuSlot);
  const gameLog = makeGameLog(root);
  const menuAction = (label: string, action: () => void): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hud-menu-action';
    button.textContent = label;
    button.addEventListener('click', () => {
      hud.closeMenu();
      inventory.close();
      statusSheet.close();
      skillBar.close();
      action();
    });
    hud.menuSlot.append(button);
  };
  menuAction('@ 상태', () => statusSheet.openSheet());
  menuAction('⚔ 장비', () => inventory.openSheet('equipment'));
  menuAction('▣ 가방', () => inventory.openSheet('bag'));
  menuAction('✦ 스킬', () => skillBar.openDetails());
  menuAction('▤ 게임 로그', () => gameLog.openHistory());

  const requested = CHARACTERS.find((character) => character.id === switches.who || character.name === switches.who);
  if (requested) begin(requested);
  else selector.show();

  const fit = (): void => {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  };

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      if (!world || !spellButtons.targetingId) return;
      const spell = spellData(spellButtons.targetingId);
      if (spell.shape === 'utility') return;
      const rect = canvas.getBoundingClientRect();
      const sx = (event.clientX - rect.left) * (canvas.width / rect.width);
      const sy = (event.clientY - rect.top) * (canvas.height / rect.height);
      const px = cellPixels(canvas.width, switches.cols);
      const x = world.hero.x + (sx - canvas.width / 2) / px;
      const y = world.hero.y + (sy - canvas.height / 2) / px;
      const target = spellAtPoint(world, spell, x, y);
      if (!target) return;
      queuedSpell = { id: spell.id, x: target.x, y: target.y };
      spellButtons.cancelTarget();
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true,
  );

  runLoop(
    () => {
      if (!world) return;
      const pressedSpell = spellButtons.takePress();
      if (pressedSpell) {
        const selectedSpell = spellData(pressedSpell);
        if (selectedSpell.shape === 'utility') {
          queuedSpell = { id: pressedSpell, x: world.hero.x, y: world.hero.y };
        } else if (timeMode.superhot) {
          if (spellButtons.targetingId === pressedSpell) spellButtons.cancelTarget();
          else spellButtons.beginTarget(pressedSpell);
        } else {
          const spell = spellData(pressedSpell);
          const target = spellTarget(world, spell);
          if (target) queuedSpell = { id: spell.id, x: target.x, y: target.y };
        }
      }
      if (!timeMode.superhot && spellButtons.targetingId) spellButtons.cancelTarget();
      stick.enabled = !spellButtons.targetingId;

      const key = keyPush(keys);
      const input: Input = {
        mx: stick.x + key.x,
        my: stick.y + key.y,
        throw: throwing.held || keys.has('Space') || keys.has('KeyJ'),
        hop: hop.held || keys.has('ShiftLeft') || keys.has('KeyK'),
        ...(queuedSpell ? { spell: queuedSpell } : {}),
      };
      queuedSpell = undefined;
      const active = Math.hypot(input.mx, input.my) > 0.01 || input.throw || input.hop || Boolean(input.spell) || stairHoldActive(world);
      if (
        !statusSheet.open &&
        !inventory.open &&
        !skillBar.expanded &&
        !gameLog.expanded &&
        !spellButtons.targetingId &&
        (!timeMode.superhot || active)
      ) {
        stepWorld(world, input);
        if (world.events.some((event) => event.type === 'floor')) fx.clear();
        fx.take(world.events);
        gameLog.take(world);
        fx.step(STEP);
      }
    },
    (between) => {
      fit();
      if (!world || !heroWalk) return;
      drawWorld(
        ctx,
        atlas,
        world,
        {
          cols: switches.cols,
          look: LOOK[switches.look],
          dpr,
          heroWalk,
          targetingSpell: spellButtons.targetingId ? spellData(spellButtons.targetingId) : undefined,
        },
        fx,
        world.over ? 1 : between,
      );
      hud.show(world);
      shopButton.hidden = !shopAccessible(world) || inventory.open || statusSheet.open || skillBar.expanded || gameLog.expanded;
      gameLog.show(world);
      skillBar.show(world);
      inventory.show(world);
      statusSheet.show(world);
      picker.show(world);
      gear.show(world);
      spellButtons.show(world);
      hop.show(world);
      throwing.show(world);
      const minimapContext = hud.minimap.getContext('2d');
      if (minimapContext) drawMiniMap(minimapContext, world);
    },
  );
}

start().catch((error: unknown) => {
  const fail = document.createElement('div');
  fail.className = 'fail';
  fail.textContent = error instanceof Error ? error.message : String(error);
  document.body.append(fail);
});
