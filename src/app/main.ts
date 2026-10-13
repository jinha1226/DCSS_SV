import '../styles/main.css';
import '../styles/layout.css';
import '../styles/theme.css';
import '../styles/ledger.css';
import { CHARACTERS } from '../data/characters';
import { DUNGEON } from '../data/packs';
import { selfSpell, spellData } from '../data/spells';
import { guardZoom } from '../input/guards';
import { keyPush, watchKeys } from '../input/keys';
import { makeStick } from '../input/stick';
import { makeGameZoom } from '../input/zoom';
import { spellTarget } from '../sim/spells';
import { shopAccessible } from '../sim/branchLoot';
import { STEP, makeWorld, stepWorld, type Input, type World } from '../sim/world';
import { makeCharacterSelect, type CharacterChoice } from '../ui/characterSelect';
import { makeEquipmentPicker } from '../ui/equipmentPicker';
import { makeGameLog } from '../ui/gameLog';
import { makeHud } from '../ui/hud';
import { makeLayoutButton } from '../ui/layoutButton';
import { makeInventorySheets } from '../ui/inventorySheets';
import { makeHopButton } from '../ui/hopButton';
import { makePickupToast } from '../ui/pickupToast';
import { makeSkillBar } from '../ui/skillBar';
import { makeSkillPicker } from '../ui/skillPicker';
import { makeLedger } from '../ui/ledger';
import { makeSpellButtons } from '../ui/spellButtons';
import { makeThrowButton } from '../ui/throwButton';
import { makeTimeModeButton } from '../ui/timeModeButton';
import { loadAtlas } from '../view/atlas';
import { Fx } from '../view/fx';
import { LOOK } from '../view/look';
import { drawMiniMap } from '../view/minimap';
import { drawWorld } from '../view/render';
import { composeDoll, DOLL_CUT, dollLayers } from '../view/doll';
import { makeDollWalk, type WalkSheet } from '../view/walk';
import { loadHeroSprites, makeHeroPose, stepPose, takePoseEvents, type HeroSprites } from '../view/heroSprite';
import { World3D } from '../view3d/world3d';
import { makeAiming, makeFloorPoint, viewForAim } from './aiming';
import { runLoop } from './loop';
import { stairHoldActive } from './stairInput';
import { readSwitches } from './switches';

async function start(): Promise<void> {
  const root = document.querySelector<HTMLDivElement>('#app');
  if (!root) return;
  guardZoom(root);

  const switches = readSwitches(location.search);
  // In 3D the world is drawn on a WebGL canvas underneath; the 2D canvas on top carries numbers and input.
  const canvas3d = switches.renderer === '3d' ? document.createElement('canvas') : undefined;
  if (canvas3d) {
    canvas3d.className = 'game-canvas world3d';
    root.append(canvas3d);
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  root.append(canvas);
  const layout = makeLayoutButton(root);
  const ctx = canvas.getContext('2d', { alpha: Boolean(canvas3d) });
  if (!ctx) return;

  const atlas = await loadAtlas();
  const world3d = canvas3d
    ? new World3D(canvas3d, atlas, switches.quality, switches.figures, switches.ground === 'tiles' ? LOOK[switches.look] : undefined)
    : undefined;
  let lastFrame = performance.now();
  let visualScale = 1;
  // ?sprite=haven swaps the DCSS hero tile for the layered 8-facing sprites; a missing set keeps the tile.
  const heroSprites: HeroSprites | undefined = switches.sprite
    ? await loadHeroSprites(switches.sprite).catch((error: unknown) => {
        console.warn(error instanceof Error ? error.message : error);
        return undefined;
      })
    : undefined;
  const heroPose = makeHeroPose();
  const stick = makeStick(canvas, root);
  const zoom = makeGameZoom(canvas, () => stick.cancel());
  const keys = watchKeys();
  const fx = new Fx();
  const hop = makeHopButton(root);
  const throwing = makeThrowButton(root);
  const picker = makeSkillPicker(root, atlas);
  const gear = makeEquipmentPicker(root);
  const spellButtons = makeSpellButtons(root);

  let selected: CharacterChoice | undefined;
  let world: World | undefined;
  let heroWalk: WalkSheet | undefined;
  /** The doll layers the flat view's walk was last cut from; redressed when gear changes. */
  let heroDoll = '';
  let dpr = 1;
  let viewCols = switches.cols;
  let queuedSpell: Input['spell'];
  const floorPoint = makeFloorPoint(
    canvas,
    () => world,
    world3d,
    () => viewCols,
  );
  const aim = makeAiming(
    canvas,
    floorPoint,
    () => world,
    spellButtons,
    world3d,
    () => viewCols,
  );

  const begin = (character: CharacterChoice): void => {
    selected = character;
    heroWalk = undefined;
    heroDoll = '';
    Object.assign(heroPose, makeHeroPose());
    if (world3d) void world3d.prepare(character.species, character.job);
    world = makeWorld({
      species: character.species,
      job: character.job,
      seed: switches.seed || Date.now() & 0x7fffffff,
      speed: switches.speed,
      depth: switches.floor,
    });
    fx.clear();
    gameLog.reset(world);
    pickups.clear();
    skillBar.close();
    inventory.close();
    ledger.close();
    aim.cancel();
    selector.hide();
    if (debug) debug.world = world;
  };

  const chooseCharacter = (): void => {
    world = undefined;
    gameLog.hide();
    pickups.clear();
    skillBar.close();
    inventory.close();
    ledger.close();
    selected = undefined;
    aim.cancel();
    selector.show();
  };

  const selector = makeCharacterSelect(root, atlas, begin);
  const debug: { world?: World } | undefined = switches.debug ? {} : undefined;
  if (debug) Object.assign(window, { __sv: Object.assign(debug, { switches, stick, keys, world3d }) });

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
  shopButton.className = 'inventory-action shop-button';
  shopButton.style.position = 'fixed';
  shopButton.style.zIndex = '14';
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
  // Status, skills and bag on one DCSS-style sheet; % / m / i open it from the keyboard.
  const ledger = makeLedger(root, atlas, () => Boolean(world) && !world?.over && !world?.rewardChoices && !inventory.open);
  const skillBar = makeSkillBar(
    hud.skillSlot,
    atlas,
    () => {
      skillBar.close();
      ledger.openTab('status');
    },
    () => ledger.openTab('skills'),
  );
  const timeMode = makeTimeModeButton(hud.menuSlot);
  const gameLog = makeGameLog(root);
  const pickups = makePickupToast(root, atlas);
  const menuAction = (label: string, action: () => void): void => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hud-menu-action';
    button.textContent = label;
    button.addEventListener('click', () => {
      hud.closeMenu();
      inventory.close();
      ledger.close();
      skillBar.close();
      action();
    });
    hud.menuSlot.append(button);
  };
  menuAction('@ 상태', () => ledger.openTab('status'));
  menuAction('⚔ 장비', () => ledger.openTab('status'));
  menuAction('▣ 가방', () => ledger.openTab('items'));
  menuAction('✦ 스킬', () => ledger.openTab('skills'));
  menuAction('▤ 게임 로그', () => gameLog.openHistory());
  menuAction('▭ 화면 구성 전환', () => layout.toggle());

  const requested = CHARACTERS.find((character) => character.id === switches.who || character.name === switches.who);
  if (requested) begin(requested);
  else selector.show();

  const fit = (): void => {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const initialCols = layout.landscape ? Math.max(switches.cols, canvas.clientWidth / 32) : switches.cols;
    viewCols = initialCols / zoom.scale;
    const width = Math.round(canvas.clientWidth * dpr);
    const height = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const mapWidth = Math.round(hud.minimap.clientWidth * dpr);
    const mapHeight = Math.round(hud.minimap.clientHeight * dpr);
    if (hud.minimap.width !== mapWidth || hud.minimap.height !== mapHeight) {
      hud.minimap.width = mapWidth;
      hud.minimap.height = mapHeight;
    }
  };

  runLoop(
    () => {
      if (!world) {
        root.classList.remove('slowmo');
        return;
      }
      const paused = ledger.open || inventory.open || skillBar.expanded || gameLog.expanded;
      const key = keyPush(keys);
      const moving = Math.hypot(stick.x + key.x, stick.y + key.y) > 0.3;
      const pressedSpell = spellButtons.takePress();
      if (pressedSpell && !paused) {
        const selectedSpell = spellData(pressedSpell);
        if (selfSpell(selectedSpell)) {
          aim.cancel();
          queuedSpell = { id: pressedSpell, x: world.hero.x, y: world.hero.y };
        } else if (timeMode.superhot) {
          if (aim.current?.kind === 'spell' && aim.current.id === pressedSpell) aim.confirm();
          else {
            stick.cancel();
            aim.begin({ kind: 'spell', id: pressedSpell });
          }
        } else {
          aim.cancel();
          const spell = spellData(pressedSpell);
          const target = spellTarget(world, spell);
          if (target) queuedSpell = { id: spell.id, x: target.x, y: target.y };
        }
      }
      if (!timeMode.superhot && aim.current?.kind === 'spell') aim.cancel();
      const buttonThrow = throwing.takePress();
      const spaceThrow = keys.takeTap('Space');
      const jThrow = keys.takeTap('KeyJ');
      const throwPressed = buttonThrow || spaceThrow || jThrow;
      let automaticThrow = false;
      if (!paused && throwPressed && world.openSkills.has('throwing') && world.ammo > 0 && world.hero.throwing <= 0) {
        if (aim.current?.kind === 'throw') {
          aim.confirm();
        } else if (moving) {
          aim.cancel();
          automaticThrow = true;
        } else {
          stick.cancel();
          aim.begin({ kind: 'throw' });
        }
      }
      const mx = stick.x + key.x;
      const my = stick.y + key.y;
      if (aim.current && Math.hypot(key.x, key.y) > 0.3) aim.cancel();
      stick.enabled = !aim.current;
      const aimed = aim.take();
      const targeting = Boolean(aim.current);
      const input: Input = {
        mx: targeting ? 0 : mx,
        my: targeting ? 0 : my,
        throw: targeting ? false : automaticThrow || aimed.throw === true,
        ...(aimed.throwAt ? { throwAt: aimed.throwAt } : {}),
        hop: targeting ? false : hop.held || keys.has('ShiftLeft') || keys.has('KeyK'),
        ...(aimed.spell || queuedSpell ? { spell: aimed.spell ?? queuedSpell } : {}),
      };
      queuedSpell = undefined;
      throwing.aiming = aim.current?.kind === 'throw';
      const active =
        Math.hypot(input.mx, input.my) > 0.01 ||
        input.throw ||
        Boolean(input.throwAt) ||
        input.hop ||
        Boolean(input.spell) ||
        stairHoldActive(world);
      const slow = timeMode.superhot && !active;
      const scale = slow ? DUNGEON.superhotSlow : 1;
      visualScale = scale;
      root.classList.toggle('slowmo', slow && !paused);
      if (!paused) {
        stepWorld(world, input, STEP * scale);
        if (world.events.some((event) => event.type === 'floor')) fx.clear();
        fx.take(world.events);
        world3d?.take(world, world.events);
        if (heroSprites) {
          takePoseEvents(heroPose, world, world.events);
          stepPose(heroPose, heroSprites, world, STEP * scale);
        }
        gameLog.take(world);
        pickups.take(world);
        fx.step(STEP * scale);
      }
    },
    (between) => {
      fit();
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastFrame) / 1000);
      lastFrame = now;
      if (!world) return;
      const layers = dollLayers(world);
      if (layers.join('|') !== heroDoll || !heroWalk) {
        heroDoll = layers.join('|');
        heroWalk = makeDollWalk(composeDoll(atlas.image, layers), DOLL_CUT);
      }
      const aimView = viewForAim(world, aim);
      if (world3d) {
        world3d.resize(canvas.width, canvas.height, dpr);
        world3d.render(
          world,
          {
            cols: viewCols,
            dpr,
            ...aimView,
            stairProgress: world.descending,
          },
          fx,
          world.over ? 1 : between,
          dt * visualScale,
          ctx,
        );
      } else
        drawWorld(
          ctx,
          atlas,
          world,
          {
            cols: viewCols,
            look: LOOK[switches.look],
            dpr,
            heroWalk,
            ...(heroSprites ? { heroSprite: { sprites: heroSprites, pose: heroPose } } : {}),
            ...aimView,
          },
          fx,
          world.over ? 1 : between,
        );
      hud.show(world);
      shopButton.hidden = !shopAccessible(world) || inventory.open || ledger.open || skillBar.expanded || gameLog.expanded;
      gameLog.show(world);
      skillBar.show(world);
      inventory.show(world);
      ledger.show(world);
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
