import '../styles/main.css';
import { CHARACTERS } from '../data/characters';
import { heroFor } from '../data/hero';
import { guardZoom } from '../input/guards';
import { keyPush, watchKeys } from '../input/keys';
import { makeStick } from '../input/stick';
import { STEP, makeWorld, stepWorld, type World } from '../sim/world';
import { makeCharacterSelect, type CharacterChoice } from '../ui/characterSelect';
import { makeEquipmentPicker } from '../ui/equipmentPicker';
import { makeHud } from '../ui/hud';
import { makeHopButton } from '../ui/hopButton';
import { makeSkillPicker } from '../ui/skillPicker';
import { makeThrowButton } from '../ui/throwButton';
import { loadAtlas } from '../view/atlas';
import { Fx } from '../view/fx';
import { LOOK } from '../view/look';
import { drawMiniMap } from '../view/minimap';
import { drawWorld } from '../view/render';
import { makeWalk, type WalkSheet } from '../view/walk';
import { runLoop } from './loop';
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

  let selected: CharacterChoice | undefined;
  let world: World | undefined;
  let heroWalk: WalkSheet | undefined;
  let dpr = 1;

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
    selector.hide();
    if (debug) debug.world = world;
  };

  const chooseCharacter = (): void => {
    world = undefined;
    selected = undefined;
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

  runLoop(
    () => {
      if (!world) return;
      const key = keyPush(keys);
      stepWorld(world, {
        mx: stick.x + key.x,
        my: stick.y + key.y,
        throw: throwing.held || keys.has('Space') || keys.has('KeyJ'),
        hop: hop.held || keys.has('ShiftLeft') || keys.has('KeyK'),
      });
      if (world.events.some((event) => event.type === 'floor')) fx.clear();
      fx.take(world.events);
      fx.step(STEP);
    },
    (between) => {
      fit();
      if (!world || !heroWalk) return;
      drawWorld(ctx, atlas, world, { cols: switches.cols, look: LOOK[switches.look], dpr, heroWalk }, fx, world.over ? 1 : between);
      hud.show(world);
      picker.show(world);
      gear.show(world);
      hop.show(world);
      throwing.show(world);
      drawMiniMap(ctx, world, dpr);
    },
  );
}

start().catch((error: unknown) => {
  const fail = document.createElement('div');
  fail.className = 'fail';
  fail.textContent = error instanceof Error ? error.message : String(error);
  document.body.append(fail);
});
