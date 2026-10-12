import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/** One cell of the floor is two metres of KayKit scenery. */
export const CELL_METRES = 2;
export const MODEL_SCALE = 1 / CELL_METRES;

const BASE = `${import.meta.env.BASE_URL}models/`;

/** Loads each GLB once and hands out independent copies (skinned meshes keep their own skeletons). */
export class ModelLibrary {
  private readonly loader = new GLTFLoader();
  private readonly files = new Map<string, Promise<GLTF>>();

  load(path: string): Promise<GLTF> {
    let file = this.files.get(path);
    if (!file) {
      file = this.loader.loadAsync(BASE + path);
      this.files.set(path, file);
    }
    return file;
  }

  /** A fresh copy of the file's scene. */
  async instance(path: string): Promise<THREE.Object3D> {
    const gltf = await this.load(path);
    return cloneSkinned(gltf.scene);
  }

  async clips(path: string): Promise<THREE.AnimationClip[]> {
    return (await this.load(path)).animations;
  }

  /** The first mesh of a file, centred on x/z with its top at y = 0, for instancing scenery. */
  async piece(path: string): Promise<{ geometry: THREE.BufferGeometry; material: THREE.Material; size: THREE.Vector3 }> {
    const gltf = await this.load(path);
    const meshes: THREE.Mesh[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
    });
    const first = meshes[0];
    if (!first) throw new Error(`모델에 메시가 없다: ${path}`);
    // Bake every mesh of the piece into one geometry in the scene's space.
    const parts = meshes.map((m) => m.geometry.clone().applyMatrix4(m.matrixWorld));
    const geometry = parts.length === 1 ? parts[0]! : mergeSimple(parts);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const centre = box.getCenter(new THREE.Vector3());
    geometry.translate(-centre.x, -box.min.y, -centre.z);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox!.getSize(new THREE.Vector3());
    const material = Array.isArray(first.material) ? first.material[0]! : first.material;
    return { geometry, material, size };
  }
}

/** Joins geometries that share the same attributes (enough for the single-material KayKit pieces). */
function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = Object.keys(parts[0]!.attributes);
  const merged = new THREE.BufferGeometry();
  for (const name of names) {
    const arrays = parts.map((p) => p.getAttribute(name) as THREE.BufferAttribute);
    const itemSize = arrays[0]!.itemSize;
    const total = arrays.reduce((n, a) => n + a.count * itemSize, 0);
    const out = new Float32Array(total);
    let at = 0;
    for (const a of arrays) {
      for (let i = 0; i < a.count; i++) for (let k = 0; k < itemSize; k++) out[at++] = a.getComponent(i, k);
    }
    merged.setAttribute(name, new THREE.BufferAttribute(out, itemSize));
  }
  const indices: number[] = [];
  let offset = 0;
  for (const p of parts) {
    const index = p.getIndex();
    const count = p.getAttribute('position').count;
    if (index) for (let i = 0; i < index.count; i++) indices.push(index.getX(i) + offset);
    else for (let i = 0; i < count; i++) indices.push(i + offset);
    offset += count;
  }
  merged.setIndex(indices);
  return merged;
}

/** Gives a model its own materials so flashes and fades on it do not touch other copies. */
export function ownMaterials(root: THREE.Object3D): THREE.MeshStandardMaterial[] {
  const owned: THREE.MeshStandardMaterial[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const swap = (m: THREE.Material): THREE.Material => {
      const copy = m.clone() as THREE.MeshStandardMaterial;
      owned.push(copy);
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    mesh.castShadow = true;
  });
  return owned;
}
