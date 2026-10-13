import * as THREE from 'three';
import { TILE_SIZE, tileRect } from '../data/tiles';
import { Cell, cellAt } from '../sim/grid';
import type { World } from '../sim/world';
import type { Sheet } from '../view/atlas';
import { isGatewayTile, stairTile } from '../view/stairTile';
import { REMEMBERED } from './dungeon';

/**
 * Branch gateways on a floor drawn with KayKit models: the DCSS gateway tile laid flat over the
 * stairs, so the way into the Snake Pit or the Swamp reads as it does in DCSS whatever the ground.
 */
export class Gateways {
  readonly group = new THREE.Group();
  private builtFor = -1;
  private marks: { mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>; cell: number }[] = [];

  constructor(private readonly sheet: Sheet) {}

  update(w: World): void {
    if (w.depth !== this.builtFor) this.build(w);
    for (const m of this.marks) {
      const level = w.visible[m.cell] ? 1 : w.seen[m.cell] ? REMEMBERED : 0;
      m.mesh.visible = level > 0;
      m.mesh.material.color.setScalar(level);
    }
  }

  private build(w: World): void {
    this.builtFor = w.depth;
    for (const m of this.marks) {
      m.mesh.removeFromParent();
      m.mesh.geometry.dispose();
      m.mesh.material.map?.dispose();
      m.mesh.material.dispose();
    }
    this.marks = [];
    for (const s of w.stairs) {
      const tile = stairTile(w, s.x, s.y, s.down);
      if (!isGatewayTile(tile) || cellAt(w.grid, s.x, s.y) === Cell.Wall) continue;
      const c = document.createElement('canvas');
      c.width = c.height = TILE_SIZE;
      const at = tileRect(tile);
      c.getContext('2d')?.drawImage(this.sheet, at.x, at.y, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
      const map = new THREE.CanvasTexture(c);
      map.magFilter = THREE.NearestFilter;
      map.minFilter = THREE.NearestFilter;
      map.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, roughness: 1, metalness: 0 }),
      );
      mesh.position.set(s.x + 0.5, 0.02, s.y + 0.5);
      this.group.add(mesh);
      this.marks.push({ mesh, cell: s.y * w.grid.w + s.x });
    }
  }
}
