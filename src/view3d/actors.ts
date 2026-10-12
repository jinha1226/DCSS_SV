import * as THREE from 'three';
import type { WeaponItem } from '../data/items';
import type { TileName } from '../data/tiles';
import { MODEL_SCALE, ownMaterials, type ModelLibrary } from './models';

export const RIG_CLIPS = 'anims/rig_medium.glb';
const FADE = 0.14;
const TURN_RATE = 14;

/** Clip names an actor understands. Characters on the shared KayKit rig all use the same names. */
export interface ClipSet {
  readonly idle: string;
  readonly run: string;
  readonly walk?: string;
  readonly hit: string;
  readonly death: string;
  readonly attacks: readonly string[];
}

const RIG_SET: ClipSet = {
  idle: 'Idle',
  run: 'Running_A',
  walk: 'Walking_A',
  hit: 'Hit_A',
  death: 'Death_A',
  attacks: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'],
};

/** Crossfading clip player: a looping base (idle/run) with one-shot moves played over it. */
export class Animator {
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private base?: THREE.AnimationAction;
  private shot?: THREE.AnimationAction;
  private shotLeft = 0;
  private held = false;

  constructor(root: THREE.Object3D, clips: readonly THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const clip of clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  duration(name: string): number {
    return this.actions.get(name)?.getClip().duration ?? 0;
  }

  /** The looping pose underneath; ignored while a held one-shot (death) is showing. */
  setBase(name: string, speed = 1): void {
    const next = this.actions.get(name);
    if (!next || this.held) return;
    next.timeScale = speed;
    if (next === this.base) return;
    next.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    if (this.base && !this.shot) next.crossFadeFrom(this.base, FADE, false);
    else if (this.base) this.base.stop();
    this.base = next;
  }

  /** Plays a clip once, squeezed into `seconds` when given, then falls back to the base. */
  play(name: string, seconds?: number, hold = false): void {
    const next = this.actions.get(name);
    if (!next || this.held) return;
    const length = next.getClip().duration;
    next.timeScale = seconds && seconds > 0 ? Math.max(0.6, length / seconds) : 1;
    next.reset().setLoop(THREE.LoopOnce, 1).play();
    next.clampWhenFinished = hold;
    const from = this.shot ?? this.base;
    if (from && from !== next) next.crossFadeFrom(from, FADE * 0.6, false);
    this.shot = next;
    this.shotLeft = length / next.timeScale;
    this.held = hold;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    if (!this.shot || this.held) return;
    this.shotLeft -= dt;
    if (this.shotLeft <= FADE) {
      const shot = this.shot;
      this.shot = undefined;
      if (this.base) {
        this.base.enabled = true;
        this.base.reset().play();
        this.base.crossFadeFrom(shot, FADE, false);
      }
    }
  }

  get busy(): boolean {
    return Boolean(this.shot) || this.held;
  }
}

/** What the world view asks of any figure, whether a rigged 3D model or a flat DCSS tile. */
export interface Figure {
  readonly root: THREE.Object3D;
  readonly busy: boolean;
  place(x: number, y: number, lift?: number): void;
  face(dx: number, dy: number): void;
  move(speed: number): void;
  attack(seconds?: number): void;
  hit(): void;
  die(): void;
  strike(amount?: number): void;
  setOpacity(value: number): void;
  update(dt: number): void;
  dispose(): void;
}

/** The hero's extra moves. */
export interface HeroFigure extends Figure {
  dress(look: HeroLook): Promise<void>;
  cast(seconds: number): void;
  throwAt(seconds: number): void;
  hop(seconds: number): void;
  cheer(): void;
  block(): void;
}

/** A posed model in the world: position, smooth turning, a white flash when struck, fading out. */
export class Actor implements Figure {
  readonly root = new THREE.Group();
  readonly model: THREE.Object3D;
  readonly animator: Animator;
  readonly clips: ClipSet;
  private readonly materials: THREE.MeshStandardMaterial[];
  private heading = 0;
  private flash = 0;
  private opacity = 1;
  private attackTurn = 0;

  constructor(model: THREE.Object3D, clips: readonly THREE.AnimationClip[], set: ClipSet, height: number) {
    this.model = model;
    this.clips = set;
    this.materials = ownMaterials(model);
    const box = new THREE.Box3().setFromObject(model);
    const tall = Math.max(0.01, box.max.y - box.min.y);
    model.scale.multiplyScalar(height / tall);
    this.root.add(model);
    this.animator = new Animator(model, clips);
    this.animator.setBase(set.idle);
  }

  place(x: number, y: number, lift = 0): void {
    this.root.position.set(x, lift, y);
  }

  /** Turns toward a direction on the floor (x right, y down the screen). */
  face(dx: number, dy: number): void {
    if (Math.hypot(dx, dy) < 1e-4) return;
    this.heading = Math.atan2(dx, dy);
  }

  /** Moves: run, walk or stand by how fast the actor is going (cells per second). */
  move(speed: number): void {
    if (speed > 1.6) this.animator.setBase(this.clips.run, Math.min(1.5, Math.max(0.7, speed / 4)));
    else if (speed > 0.25) this.animator.setBase(this.clips.walk ?? this.clips.run, this.clips.walk ? 1 : 0.6);
    else this.animator.setBase(this.clips.idle);
  }

  attack(seconds?: number): void {
    const list = this.clips.attacks;
    const name = list[this.attackTurn++ % list.length];
    if (name) this.animator.play(name, seconds);
  }

  hit(): void {
    this.flash = 1;
    if (!this.animator.busy) this.animator.play(this.clips.hit, 0.35);
  }

  die(): void {
    this.flash = 0.6;
    this.animator.play(this.clips.death, undefined, true);
  }

  /** Lights the model white for a moment. */
  strike(amount = 1): void {
    this.flash = Math.max(this.flash, amount);
  }

  setOpacity(value: number): void {
    if (Math.abs(value - this.opacity) < 0.01) return;
    this.opacity = value;
    for (const m of this.materials) {
      m.transparent = value < 1;
      m.opacity = value;
      m.depthWrite = value >= 1;
    }
  }

  update(dt: number): void {
    this.animator.update(dt);
    let turn = this.heading - this.model.rotation.y;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    this.model.rotation.y += turn * Math.min(1, dt * TURN_RATE);
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5);
      const glow = this.flash * this.flash;
      for (const m of this.materials) m.emissive.setRGB(glow, glow * 0.95, glow * 0.85);
    }
  }

  get busy(): boolean {
    return this.animator.busy;
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const m of this.materials) m.dispose();
  }
}

function findBone(root: THREE.Object3D, name: RegExp): THREE.Object3D | undefined {
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!found && name.test(o.name)) found = o;
  });
  return found;
}

/** Hero models by job; props a model carries in its default pose are shown only when worn. */
const HERO_MODELS: Record<string, string> = {
  berserker: 'chars/barbarian.glb',
  hunter: 'chars/rogue.glb',
  spellblade: 'chars/knight.glb',
};
const CASTER_MODEL = 'chars/mage.glb';

/** Every spellcasting job (fire_mage, summoner, hexer, ...) wears the mage's robe and hat. */
function heroModel(job: string): string {
  return HERO_MODELS[job] ?? (/mage|summoner|hexer|necromancer|conjurer/.test(job) ? CASTER_MODEL : 'chars/knight.glb');
}
const PROP = /(sword|axe|shield|staff|wand|crossbow|knife|throwable|spellbook|mug)/i;
const HELMET = /(Knight_Helmet)/;
const CAPE = /_Cape$/;

export interface HeroLook {
  readonly weapon: WeaponItem;
  readonly offhand?: string;
  readonly helmet: boolean;
  readonly cloak: boolean;
  /** The DCSS doll layers for figures drawn as tiles. */
  readonly layers?: readonly TileName[];
}

/** Which held model a weapon shows as, and whether it is held in both hands. */
export function heldFor(weapon: WeaponItem): { model?: string; twoHanded: boolean; kind: 'blade' | 'axe' | 'ranged' | 'magic' } {
  if (weapon.kind === 'staff' || weapon.kind === 'rod') return { model: 'held/staff.glb', twoHanded: true, kind: 'magic' };
  if (weapon.kind === 'wand') return { model: 'held/wand.glb', twoHanded: false, kind: 'magic' };
  if (weapon.family === 'ranged') return { model: 'held/crossbow_2handed.glb', twoHanded: true, kind: 'ranged' };
  if (weapon.family === 'axe') {
    const big = weapon.hands === 2 || weapon.baseId === 'battle_axe';
    return { model: big ? 'held/axe_2handed.glb' : 'held/axe_1handed.glb', twoHanded: big, kind: 'axe' };
  }
  const big = weapon.hands === 2 || weapon.baseId === 'great_sword';
  return { model: big ? 'held/sword_2handed.glb' : 'held/sword_1handed.glb', twoHanded: big, kind: 'blade' };
}

const SHIELDS: Record<string, string> = { buckler: 'held/shield_round.glb', kite_shield: 'held/shield_badge.glb' };

/** The hero: a KayKit adventurer with the worn weapon, shield, helmet and cape attached to the rig. */
export class HeroActor extends Actor implements HeroFigure {
  private lookKey = '';
  private readonly right?: THREE.Object3D;
  private readonly left?: THREE.Object3D;
  private held: THREE.Object3D[] = [];
  private kind: 'blade' | 'axe' | 'ranged' | 'magic' = 'blade';

  static async create(models: ModelLibrary, job: string): Promise<HeroActor> {
    const [model, clips] = await Promise.all([models.instance(heroModel(job)), models.clips(RIG_CLIPS)]);
    return new HeroActor(models, model, clips);
  }

  private constructor(
    private readonly models: ModelLibrary,
    model: THREE.Object3D,
    clips: readonly THREE.AnimationClip[],
  ) {
    super(model, clips, RIG_SET, 1.42);
    // The loader drops the dot from bone names ('handslot.r' arrives as 'handslotr').
    this.right = findBone(model, /^handslot\.?r$/i);
    this.left = findBone(model, /^handslot\.?l$/i);
    model.traverse((o) => {
      if (PROP.test(o.name) && (o as THREE.Mesh).isMesh) o.visible = false;
    });
  }

  /** Swaps the attached gear when what is worn changes. */
  async dress(look: HeroLook): Promise<void> {
    const key = `${look.weapon.baseId}|${look.weapon.kind ?? ''}|${look.offhand ?? ''}|${look.helmet}|${look.cloak}`;
    if (key === this.lookKey) return;
    this.lookKey = key;
    const held = heldFor(look.weapon);
    this.kind = held.kind;
    this.model.traverse((o) => {
      if (HELMET.test(o.name)) o.visible = look.helmet;
      if (CAPE.test(o.name)) o.visible = look.cloak;
    });
    for (const h of this.held) h.removeFromParent();
    this.held = [];
    const shield = !held.twoHanded && look.offhand ? SHIELDS[look.offhand] : undefined;
    const [weapon, guard] = await Promise.all([
      held.model ? this.models.instance(held.model) : undefined,
      shield ? this.models.instance(shield) : undefined,
    ]);
    if (key !== this.lookKey) return;
    if (weapon && this.right) this.attach(weapon, this.right);
    if (guard && this.left) this.attach(guard, this.left);
    this.setStance(held.twoHanded);
  }

  private attach(item: THREE.Object3D, slot: THREE.Object3D): void {
    ownMaterials(item);
    // Held models are authored in the same metres as the rig; the slot bone already carries the rig's scale.
    item.scale.setScalar(1);
    slot.add(item);
    this.held.push(item);
  }

  private setStance(twoHanded: boolean): void {
    const clips = this.clips as { -readonly [K in keyof ClipSet]: ClipSet[K] };
    clips.idle = twoHanded && this.kind !== 'magic' && this.kind !== 'ranged' ? '2H_Melee_Idle' : 'Idle';
    clips.attacks =
      this.kind === 'magic'
        ? ['Spellcast_Shoot']
        : this.kind === 'ranged'
          ? ['2H_Ranged_Shoot']
          : twoHanded
            ? this.kind === 'axe'
              ? ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice']
              : ['2H_Melee_Attack_Slice', '2H_Melee_Attack_Stab']
            : this.kind === 'axe'
              ? ['1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal']
              : ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'];
    this.animator.setBase(clips.idle);
  }

  cast(seconds: number): void {
    this.animator.play('Spellcast_Shoot', seconds);
  }

  throwAt(seconds: number): void {
    this.animator.play('Throw', seconds);
  }

  hop(seconds: number): void {
    this.animator.play('Jump_Full_Short', seconds);
  }

  cheer(): void {
    this.animator.play('Cheer', 1.2);
  }

  block(): void {
    this.animator.play('Block', 0.35);
  }
}

export { MODEL_SCALE };
