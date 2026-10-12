import type * as THREE from 'three';
import { Actor, RIG_CLIPS, type ClipSet } from './actors';
import type { ModelLibrary } from './models';

/** Clip names per family of models. */
const HUMANOID: ClipSet = { idle: 'Idle', run: 'Run', walk: 'Walk', hit: 'HitReact', death: 'Death', attacks: ['Weapon', 'Punch'] };
const BEAST: ClipSet = { idle: 'Idle', run: 'Gallop', walk: 'Walk', hit: 'Idle_HitReact1', death: 'Death', attacks: ['Attack'] };
const BLOB: ClipSet = { idle: 'Idle', run: 'Walk', hit: 'HitRecieve', death: 'Death', attacks: ['Bite_Front'] };
const SKELETON: ClipSet = {
  idle: 'Idle',
  run: 'Running_A',
  walk: 'Walking_A',
  hit: 'Hit_A',
  death: 'Death_A',
  attacks: ['1H_Melee_Attack_Chop', 'Unarmed_Idle'],
};

/** How a monster kind is shown: which model, how tall (cells), a colour wash, and whether it flies. */
export interface Look {
  readonly model: string;
  readonly clips: ClipSet;
  /** Clips come from the shared KayKit rig library rather than the model's own file. */
  readonly rig?: boolean;
  readonly height: number;
  readonly tint?: number;
  readonly hover?: number;
}

const LOOKS: Record<string, Look> = {
  rat: { model: 'creatures/blob_dog.glb', clips: BLOB, height: 0.42, tint: 0x9a8a78 },
  jackal: { model: 'creatures/fox.glb', clips: BEAST, height: 0.62, tint: 0xd9b98a },
  bat: { model: 'creatures/blob_pigeon.glb', clips: BLOB, height: 0.4, tint: 0x5a4a5e, hover: 0.55 },
  adder: { model: 'creatures/green_blob.glb', clips: BLOB, height: 0.32, tint: 0x8fae6a },
  wolf_spider: { model: 'creatures/spiky_blob.glb', clips: BLOB, height: 0.45, tint: 0x8a6a4a },
  orb_spider: { model: 'creatures/spiky_blob.glb', clips: BLOB, height: 0.5, tint: 0x7a7ab0 },
  lair_wolf: { model: 'creatures/wolf.glb', clips: BEAST, height: 0.75 },
  lair_yak: { model: 'creatures/bull.glb', clips: BEAST, height: 1.05, tint: 0x8a6a50 },
  goblin: { model: 'creatures/blob_orc.glb', clips: BLOB, height: 0.8, tint: 0xb8d090 },
  kobold: { model: 'creatures/monkroose.glb', clips: HUMANOID, height: 0.85, tint: 0xc9a27a },
  gnoll: { model: 'creatures/tribal.glb', clips: HUMANOID, height: 1.15, tint: 0xd8b880 },
  ogre: { model: 'creatures/orc.glb', clips: HUMANOID, height: 1.75, tint: 0xc8a888 },
  merfolk: { model: 'creatures/fish.glb', clips: HUMANOID, height: 1.1 },
  merfolk_aquamancer: { model: 'creatures/fish.glb', clips: HUMANOID, height: 1.1, tint: 0x9ec8ff },
  merfolk_javelineer: { model: 'creatures/fish.glb', clips: HUMANOID, height: 1.15, tint: 0xd8e8b0 },
  naga: { model: 'creatures/demon.glb', clips: HUMANOID, height: 1.25, tint: 0x9ad08a },
  naga_mage: { model: 'creatures/blue_demon.glb', clips: HUMANOID, height: 1.25, tint: 0xc8a8ff },
  bog_body: { model: 'chars/skeleton_minion.glb', clips: SKELETON, rig: true, height: 1.15, tint: 0x9aa878 },
  hydra: { model: 'creatures/dino.glb', clips: HUMANOID, height: 1.55, tint: 0x7ab07a },
  salamander: { model: 'creatures/dino.glb', clips: HUMANOID, height: 0.95, tint: 0xff8a5a },
  swamp_drake: { model: 'creatures/dino.glb', clips: HUMANOID, height: 1.25, tint: 0x6a8a5a },
};

/** Creatures read better a little larger than their size in cells. */
const SIZE = 1.15;

const FALLBACK: Look = { model: 'chars/skeleton_warrior.glb', clips: SKELETON, rig: true, height: 1.1 };

export function lookFor(kind: string): Look {
  return LOOKS[kind] ?? FALLBACK;
}

export async function makeMonsterActor(models: ModelLibrary, kind: string): Promise<{ actor: Actor; look: Look }> {
  const look = lookFor(kind);
  const [model, clips] = await Promise.all([models.instance(look.model), models.clips(look.rig ? RIG_CLIPS : look.model)]);
  const actor = new Actor(model, clips, look.clips, look.height * SIZE);
  if (look.tint !== undefined) tint(actor.model, look.tint);
  return { actor, look };
}

/** Washes a model's own colours toward a tint, keeping their light and dark. */
function tint(root: THREE.Object3D, colour: number): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      const std = m as THREE.MeshStandardMaterial;
      if (std.color)
        std.color.multiply({ r: ((colour >> 16) & 255) / 255, g: ((colour >> 8) & 255) / 255, b: (colour & 255) / 255 } as THREE.Color);
    }
  });
}
