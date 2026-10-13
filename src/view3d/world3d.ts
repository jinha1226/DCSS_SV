import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { SpellData } from '../data/spells';
import { DUNGEON } from '../data/packs';
import { objectiveFor } from '../sim/objectives';
import { STEP, type Monster, type SimEvent, type World } from '../sim/world';
import type { Atlas } from '../view/atlas';
import { dollLayers } from '../view/doll';
import type { Fx } from '../view/fx';
import { HeroActor, type Figure, type HeroFigure } from './actors';
import { lookFor, makeMonsterActor, type Look } from './bestiary';
import { DungeonView, type GroundView } from './dungeon';
import { glowTexture } from './glyphs';
import { TileGround } from './tileGround';
import type { Look as FloorLook } from '../view/look';
import { Effects } from './effects';
import { LootView } from './loot';
import { ModelLibrary } from './models';
import { Overlay } from './overlay';
import { Particles } from './particles';
import { Gateways } from './gateways';
import { Remains } from './remains';
import { floorName } from '../view/floorName';
import { HeroTile, makeMonsterTile, tileFigureHeight } from './tileFigures';

const PITCH = THREE.MathUtils.degToRad(56);
const FOV = 34;
/** The 3D view stands closer than the flat one: models need more pixels than DCSS tiles to read. */
const ZOOM = 0.68;
const TORCH_LIGHTS = 4;
const HIT_COLOURS: Record<string, number> = {
  axe: 0xfff1d0,
  arrow: 0xf0e2b8,
  spell: 0xc8c6ff,
  horns: 0xffcf6a,
  headbutt_back: 0xffcf6a,
  throw: 0xd2e8ff,
  thorns: 0xd8a6ff,
};

export const ndcFromUnit = (u: number, v: number): THREE.Vector2 => new THREE.Vector2(u * 2 - 1, -(v * 2 - 1));
interface Creature {
  actor?: Figure;
  readonly look: Look;
  wind: number;
  lunge: number;
  dead: number;
}

export interface View3D {
  readonly cols: number;
  readonly dpr: number;
  readonly targetingSpell?: SpellData;
  readonly targets?: readonly Monster[];
  /** The creature nearest the pointer while aiming, drawn with a brighter circle. */
  readonly focus?: Monster;
  readonly throwAim?: {
    readonly targets: readonly Monster[];
    readonly focus?: Monster;
    readonly point?: { readonly x: number; readonly y: number };
  };
  readonly stairProgress: number;
}

/** The 3D picture of the world: it reads the rules' state every frame and never changes it. */
export class World3D {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 80);
  private readonly composer?: EffectComposer;
  private readonly bloom?: UnrealBloomPass;
  private readonly models = new ModelLibrary();
  private readonly kaykit = new DungeonView(this.models);
  private readonly tileGround?: TileGround;
  private dungeon: GroundView = this.kaykit;
  private readonly particles = new Particles();
  private readonly effects: Effects;
  private readonly lootView: LootView;
  readonly overlay: Overlay;
  private hero?: HeroFigure;
  private heroKey = '';
  private readonly creatures = new Map<Monster, Creature>();
  private readonly remains: Remains;
  private readonly gateways: Gateways;
  private readonly hemi = new THREE.HemisphereLight(0x9aa6cc, 0x3a2a1c, 0.7);
  private readonly sun = new THREE.DirectionalLight(0xe6ecff, 1.15);
  private readonly heroLight = new THREE.PointLight(0xffc27a, 5, 8, 1.3);
  private readonly torchLights: THREE.PointLight[] = [];
  private readonly look = new THREE.Vector3();
  private shake = 0;
  private torchScale = 1;
  private time = 0;
  private lastLevel = 0;
  private lastMana = 0;
  private lastHop = 0;
  private building = false;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly atlas: Atlas,
    private readonly quality: 'high' | 'low',
    /** 'tiles' stands DCSS tiles on the 3D floor; 'models' uses the rigged KayKit and Quaternius figures. */
    private readonly figures: 'tiles' | 'models' = 'tiles',
    /** The DCSS look the Dungeon branch is built in (other branches use their own); without it every floor is KayKit. */
    look?: FloorLook,
  ) {
    if (look) this.tileGround = new TileGround(atlas, look, glowTexture());
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = quality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color(0x07060a);
    this.scene.fog = new THREE.Fog(0x07060a, 14, 30);

    this.scene.add(this.hemi);
    this.sun.position.set(-4, 10, 3);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -9;
    s.right = s.top = 9;
    s.near = 1;
    s.far = 30;
    this.sun.shadow.bias = -0.0015;
    this.scene.add(this.sun, this.sun.target, this.heroLight);
    for (let i = 0; i < TORCH_LIGHTS; i++) {
      const light = new THREE.PointLight(0xff9a48, 0, 5.5, 1.6);
      this.torchLights.push(light);
      this.scene.add(light);
    }

    this.effects = new Effects(this.particles);
    this.lootView = new LootView(this.models, atlas.image, figures === 'tiles');
    this.overlay = new Overlay(this.camera);
    this.remains = new Remains(atlas.image);
    this.gateways = new Gateways(atlas.image);
    this.scene.add(
      this.kaykit.group,
      ...(this.tileGround ? [this.tileGround.group] : []),
      this.effects.group,
      this.lootView.group,
      this.remains.group,
      this.gateways.group,
      this.particles.points,
    );

    if (quality === 'high') {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.45, 0.45, 0.9);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
  }

  /** Makes the hero figure for this species and job before the first frame. */
  /** Makes the hero's figure; `makeHero` swaps in another tile-style figure (e.g. a layered sprite set). */
  async prepare(species: string, job: string, makeHero?: () => HeroFigure): Promise<void> {
    const key = `${species}|${job}`;
    if (this.hero && this.heroKey === key) return;
    this.hero?.dispose();
    this.heroKey = key;
    if (this.figures === 'tiles') {
      this.hero = makeHero?.() ?? new HeroTile(this.atlas);
    } else {
      this.hero = await HeroActor.create(this.models, job);
    }
    this.scene.add(this.hero.root);
  }

  /** Point on the floor under the pointer. u and v are fractions of the canvas box. */
  pick(u: number, v: number): { x: number; y: number } | undefined {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndcFromUnit(u, v), this.camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return undefined;
    return { x: hit.x, y: hit.z };
  }

  /** Where a point above the floor lands on the canvas, as fractions of the canvas box. */
  project(x: number, z: number, height: number): { u: number; v: number } | undefined {
    const point = new THREE.Vector3(x, height, z).project(this.camera);
    if (point.z > 1) return undefined;
    return { u: point.x * 0.5 + 0.5, v: -point.y * 0.5 + 0.5 };
  }

  resize(width: number, height: number, dpr: number): void {
    const pixel = Math.min(dpr, this.quality === 'high' ? 2 : 1.25);
    const w = Math.max(1, Math.round(width / dpr));
    const h = Math.max(1, Math.round(height / dpr));
    if (this.renderer.getPixelRatio() !== pixel) this.renderer.setPixelRatio(pixel);
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
      this.composer?.setPixelRatio(pixel);
      this.composer?.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.particles.setScreenHeight(h * pixel);
    }
  }

  /** Reacts to what just happened in the rules: blows, wounds, deaths, new floors. */
  take(w: World, events: readonly SimEvent[]): void {
    const hero = this.hero;
    for (const e of events) {
      switch (e.type) {
        case 'swing': {
          const target = nearest(w, w.hero.x, w.hero.y, 3);
          if (target && hero) hero.face(target.x - w.hero.x, target.y - w.hero.y);
          hero?.attack(Math.min(0.55, w.weapon.every * 0.9));
          this.effects.swing(
            w.hero.x,
            w.hero.y,
            e.reach,
            hero ? Math.atan2(target ? target.y - w.hero.y : 1, target ? target.x - w.hero.x : 0) : 0,
          );
          break;
        }
        case 'hit': {
          const m = nearest(w, e.x, e.y, 1.2);
          const c = m && this.creatures.get(m);
          c?.actor?.hit();
          this.effects.impact(e.x, e.y + 0.5, HIT_COLOURS[e.by] ?? 0xffffff, e.by === 'horns');
          this.shake = Math.max(this.shake, e.by === 'horns' ? 0.18 : 0.06);
          break;
        }
        case 'kill':
          this.effects.death(e.x, e.y + 0.5);
          this.shake = Math.max(this.shake, 0.1);
          break;
        case 'hurt':
          hero?.hit();
          this.effects.hurt(w.hero.x, w.hero.y);
          this.overlay.hurt(e.amount);
          this.shake = Math.max(this.shake, 0.22);
          break;
        case 'block':
          hero?.block();
          break;
        case 'throw':
          hero?.throwAt(0.4);
          break;
        case 'floor':
          this.clearFloor();
          this.overlay.announce(floorName(w), '새로운 층', '#e9d29a', 2.4);
          break;
        case 'rune':
          this.overlay.announce('룬 획득', `${e.branch}의 룬`, '#c9a6ff', 3);
          break;
        case 'orb':
          this.overlay.announce('조트의 오브', '이제 지상으로', '#ffd27a', 3.2);
          break;
        default:
          break;
      }
    }
  }

  /** Forgets the figures, effects and remains of the floor being left (or of a world being replaced). */
  clearFloor(): void {
    for (const c of this.creatures.values()) c.actor?.dispose();
    this.creatures.clear();
    this.effects.clearFloor();
    this.lootView.clearFloor();
    this.remains.clear();
  }

  /** Draws one frame. `between` blends the last two steps of the rules; `dt` is real seconds since the last frame. */
  render(w: World, view: View3D, fx: Fx, between: number, dt: number, overlayCtx: CanvasRenderingContext2D): void {
    this.time += dt;
    // Every branch is drawn in its own DCSS tiles when the tile ground is on; otherwise in KayKit.
    const ground = this.tileGround ?? this.kaykit;
    if (ground !== this.dungeon) {
      this.dungeon = ground;
      // Flat DCSS tiles want even, bright light like the 2D view; the KayKit kit reads better moodier.
      const tiles = ground === this.tileGround;
      this.hemi.intensity = tiles ? 1.25 : 0.7;
      this.sun.intensity = tiles ? 0.9 : 1.15;
      // Film tone mapping dulls flat pixel art; tiles are shown at their own colours.
      this.renderer.toneMapping = tiles ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      this.torchScale = tiles ? 0.45 : 1;
      this.kaykit.group.visible = ground === this.kaykit;
      if (this.tileGround) this.tileGround.group.visible = ground === this.tileGround;
    }
    if (!this.building) {
      this.building = true;
      void this.dungeon.ensure(w).finally(() => {
        this.building = false;
      });
    }
    this.dungeon.updateSight(w, this.time);
    this.syncHero(w, between, dt);
    this.syncCreatures(w, between, dt);
    this.remains.update(w, dt);
    // The tile ground draws its own gateways; the KayKit ground gets them laid over its stairs.
    this.gateways.group.visible = this.dungeon === this.kaykit;
    if (this.gateways.group.visible) this.gateways.update(w);

    const stair = w.stairs.find((s) => s.down && Math.floor(w.hero.x) === s.x && Math.floor(w.hero.y) === s.y);
    const objective = objectiveFor(w);
    this.effects.syncMissiles(w, between, this.time, dt);
    this.lootView.syncLoot(w, this.time);
    this.lootView.syncMarkers(w, w.descending / DUNGEON.descend, w.descending > 0 ? stair : undefined, objective, this.time);
    const targetStyle = view.targetingSpell
      ? {
          colour: view.targetingSpell.colour,
          radius: (monster: Monster): number => view.targetingSpell?.radius || monster.stats.radius + 0.35,
        }
      : view.throwAim
        ? { colour: '#ffff55', radius: (monster: Monster): number => monster.stats.radius + 0.35 }
        : undefined;
    this.effects.showTargets(view.throwAim?.targets ?? view.targets ?? [], this.time, view.throwAim?.focus ?? view.focus, targetStyle);
    this.effects.showAimPoint(view.throwAim?.focus ? undefined : view.throwAim?.point);
    this.effects.update(dt);
    this.particles.update(dt);

    this.placeCamera(w, between, view.cols, dt);
    this.placeLights(w);
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);

    // The reward cards carry their own title; the banner would show through them.
    if (w.rewardChoices) this.overlay.quiet();
    this.overlay.step(dt);
    this.overlay.draw(overlayCtx, w, fx, view.dpr, between, (m) => this.heightOf(m));
  }

  private heightOf(m: Monster): number {
    const look = this.creatures.get(m)?.look ?? lookFor(m.kind.id);
    if (this.figures === 'tiles') return tileFigureHeight(m.kind.id) + (look.hover ?? 0);
    return look.height + (look.hover ?? 0);
  }

  private syncHero(w: World, between: number, dt: number): void {
    const hero = this.hero;
    if (!hero) return;
    const h = w.hero;
    void hero.dress({
      weapon: w.weapon,
      offhand: w.gear.offhand,
      helmet: Boolean(w.gear.helmet),
      cloak: Boolean(w.gear.cloak),
      layers: dollLayers(w),
      world: w,
    });
    let x = h.px + (h.x - h.px) * between;
    let y = h.py + (h.y - h.py) * between;
    let lift = 0;
    if (h.hopTime > 0 && h.hopDuration > 0) {
      const t = 1 - h.hopTime / h.hopDuration;
      x = h.hopFromX + (h.hopToX - h.hopFromX) * t;
      y = h.hopFromY + (h.hopToY - h.hopFromY) * t;
      lift = Math.sin(t * Math.PI) * 0.55;
      if (this.lastHop <= 0) hero.hop(h.hopDuration);
    }
    this.lastHop = h.hopTime;
    hero.place(x, y, lift);
    const dx = h.x - h.px;
    const dy = h.y - h.py;
    if (h.moving && !hero.busy) hero.face(dx, dy);
    hero.move(h.moving && !w.over ? Math.max(2, Math.hypot(dx, dy) / STEP) : 0);
    if (h.level > this.lastLevel && this.lastLevel > 0) {
      this.effects.levelUp(x, y);
      hero.cheer();
      this.overlay.announce('LEVEL UP', `레벨 ${h.level}`, '#ffd27a');
      this.shake = Math.max(this.shake, 0.12);
    }
    this.lastLevel = h.level;
    if (h.mana < this.lastMana - 0.5 && !w.over) hero.cast(0.45);
    this.lastMana = h.mana;
    if (w.over && !hero.busy) hero.die();
    hero.update(dt);
  }

  private syncCreatures(w: World, between: number, dt: number): void {
    const live = new Set<Monster>();
    for (const m of w.monsters) {
      if (m.hp <= 0) continue;
      live.add(m);
      let c = this.creatures.get(m);
      if (!c) {
        c = { look: lookFor(m.kind.id), wind: -1, lunge: 0, dead: 0 };
        this.creatures.set(m, c);
        const slot = c;
        if (this.figures === 'tiles') {
          slot.actor = makeMonsterTile(this.atlas, m.kind.id, m.kind.tile);
          this.scene.add(slot.actor.root);
        } else
          void makeMonsterActor(this.models, m.kind.id).then(({ actor }) => {
            if (!this.creatures.has(m)) {
              actor.dispose();
              return;
            }
            slot.actor = actor;
            this.scene.add(actor.root);
          });
      }
      const actor = c.actor;
      if (!actor) continue;
      const x = m.px + (m.x - m.px) * between;
      const y = m.py + (m.y - m.py) * between;
      const hover = c.look.hover ? c.look.hover + Math.sin(this.time * 6 + m.x) * 0.06 : 0;
      actor.place(x, y, hover);
      actor.root.visible = Boolean(w.visible[Math.floor(m.y) * w.grid.w + Math.floor(m.x)]);
      const dx = m.x - m.px;
      const dy = m.y - m.py;
      if (m.wind >= 0) {
        actor.face(w.hero.x - m.x, w.hero.y - m.y);
        if (c.wind < 0) actor.attack(Math.max(0.25, m.stats.windup + 0.15));
      } else if (Math.hypot(dx, dy) > 1e-4) {
        actor.face(dx, dy);
      }
      if (m.lunge > 0 && c.lunge <= 0) actor.attack(0.25);
      c.wind = m.wind;
      c.lunge = m.lunge;
      actor.move(m.stun > 0 ? 0 : Math.hypot(dx, dy) / STEP);
      if (m.flash > 0) actor.strike(0.8);
      actor.update(dt);
    }
    for (const [m, c] of this.creatures) {
      if (live.has(m)) continue;
      this.creatures.delete(m);
      if (!c.actor) continue;
      this.remains.killed(m.kind.id, m.kind.tile, c.actor);
    }
  }

  private placeCamera(w: World, between: number, cols: number, dt: number): void {
    const h = w.hero;
    const x = h.px + (h.x - h.px) * between;
    const y = h.py + (h.y - h.py) * between;
    // Fit `cols` cells across a portrait screen, or the same number of rows down a landscape one.
    const cells = cols * ZOOM;
    const halfTall = THREE.MathUtils.degToRad(FOV / 2);
    const halfWide = Math.atan(Math.tan(halfTall) * this.camera.aspect);
    const distance = Math.max(cells / 2 / Math.tan(halfWide), (cells * 0.62) / Math.tan(halfTall));
    const target = new THREE.Vector3(x, 0.35, y + 0.15);
    this.look.lerp(target, this.look.lengthSq() === 0 ? 1 : Math.min(1, dt * 10));
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const s = this.shake * this.shake * 4;
    const jitter = new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    this.camera.position.set(this.look.x, this.look.y + Math.sin(PITCH) * distance, this.look.z + Math.cos(PITCH) * distance).add(jitter);
    this.camera.lookAt(this.look.clone().add(jitter));
    const fog = this.scene.fog as THREE.Fog;
    fog.near = distance * 0.9;
    fog.far = distance * 1.9;
  }

  private placeLights(w: World): void {
    const h = this.hero?.root.position ?? new THREE.Vector3(w.hero.x, 0, w.hero.y);
    this.sun.position.set(h.x - 4, 10, h.z + 3);
    this.sun.target.position.set(h.x, 0, h.z);
    const flicker = 1 + Math.sin(this.time * 13) * 0.04 + Math.sin(this.time * 7.3) * 0.05;
    this.heroLight.position.set(h.x - 0.3, 2.6, h.z + 0.9);
    this.heroLight.intensity = 5 * flicker;
    const near = this.dungeon.torches
      .map((p) => ({ p, d: p.distanceToSquared(h) }))
      .filter((t) => t.d < 140)
      .sort((a, b) => a.d - b.d)
      .slice(0, TORCH_LIGHTS);
    this.torchLights.forEach((light, i) => {
      const t = near[i];
      if (!t || !w.seen[Math.floor(t.p.z) * w.grid.w + Math.floor(t.p.x)]) {
        light.intensity = 0;
        return;
      }
      light.position.copy(t.p);
      light.intensity = 3 * this.torchScale * (1 + Math.sin(this.time * 11 + i * 2.1) * 0.08);
    });
  }
}

function nearest(w: World, x: number, y: number, within: number): Monster | undefined {
  let best: Monster | undefined;
  let bestD = within;
  for (const m of w.monsters) {
    if (m.hp <= 0) continue;
    const d = Math.hypot(m.x - x, m.y - y);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}
