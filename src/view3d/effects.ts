import * as THREE from 'three';
import type { Monster, World } from '../sim/world';
import { circleRingTexture, circleSigilTexture, glowTexture, lightMaterial } from './glyphs';
import type { Particles } from './particles';

const UP = new THREE.Vector3(0, 1, 0);

/** Short-lived meshes that animate themselves and then go away. */
interface Flare {
  readonly object: THREE.Object3D;
  age: number;
  readonly life: number;
  readonly tick: (t: number, dt: number) => void;
}

/** Everything drawn that is not the dungeon, a creature or loot: spells, shots, circles, bursts. */
export class Effects {
  readonly group = new THREE.Group();
  private readonly ring = circleRingTexture();
  private readonly sigil = circleSigilTexture();
  private readonly glow = glowTexture();
  private readonly flares: Flare[] = [];
  private readonly circles: THREE.Group[] = [];
  private readonly shotMeshes = new Map<object, THREE.Object3D>();
  private readonly clouds = new Map<object, THREE.Mesh>();
  private readonly visuals = new Map<object, THREE.Object3D>();

  constructor(private readonly particles: Particles) {}

  // ---------- magic circles ----------

  private makeCircle(): THREE.Group {
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lightMaterial(this.ring, 0xffffff, 0.9));
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lightMaterial(this.sigil, 0xffffff, 0.85));
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lightMaterial(this.glow, 0xffffff, 0.35));
    for (const m of [pool, outer, inner]) {
      m.rotation.x = -Math.PI / 2;
      m.renderOrder = 3;
      g.add(m);
    }
    inner.position.y = 0.01;
    outer.position.y = 0.02;
    g.userData = { outer, inner, pool };
    this.group.add(g);
    return g;
  }

  /** Turning circles under valid targets; the one nearest the pointer burns brighter. */
  showTargets(
    targets: readonly Monster[],
    time: number,
    focus: Monster | undefined,
    style?: { readonly colour: string; readonly radius: (monster: Monster) => number },
  ): void {
    const count = style ? targets.length : 0;
    while (this.circles.length < count) this.circles.push(this.makeCircle());
    const colour = new THREE.Color(style?.colour ?? '#ffffff');
    this.circles.forEach((g, i) => {
      const m = targets[i];
      g.visible = Boolean(style && m && i < count);
      if (!g.visible || !m || !style) return;
      const radius = Math.max(0.55, style.radius(m));
      const bright = m === focus ? 1.35 : 1;
      const pulse = 1 + Math.sin(time * 5 + i) * 0.04;
      g.position.set(m.x, 0.04, m.y);
      g.scale.setScalar(radius * 2 * pulse);
      const { outer, inner, pool } = g.userData as Record<string, THREE.Mesh>;
      outer!.rotation.z = time * 0.6;
      inner!.rotation.z = -time * 1.1;
      for (const mesh of [outer!, inner!, pool!]) (mesh.material as THREE.MeshBasicMaterial).color.copy(colour).multiplyScalar(bright);
    });
  }

  // ---------- one-off flares ----------

  private flare(object: THREE.Object3D, life: number, tick: (t: number, dt: number) => void): void {
    this.group.add(object);
    this.flares.push({ object, age: 0, life, tick });
  }

  /** The hero's blow: a bright crescent sweeping once round at waist height. */
  swing(x: number, y: number, reach: number, heading: number): void {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { head: { value: 0 }, fade: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float head; uniform float fade; varying vec2 vUv;
        void main(){
          float behind = head - vUv.x;
          float a = behind < 0.0 ? 0.0 : exp(-behind * 7.0);
          float edge = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.75, 1.0, vUv.y));
          gl_FragColor = vec4(vec3(1.0, 0.97, 0.9), a * edge * fade);
        }`,
    });
    const geometry = new THREE.RingGeometry(reach * 0.45, reach, 64, 1, 0, Math.PI * 2);
    // Ring UVs run across; remap u to angle and v to radius for the sweep shader.
    const pos = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const a = Math.atan2(pos.getY(i), pos.getX(i));
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, ((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2), (r - reach * 0.45) / (reach * 0.55));
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = heading;
    mesh.position.set(x, 0.45, y);
    mesh.renderOrder = 4;
    this.flare(mesh, 0.26, (t) => {
      material.uniforms.head!.value = Math.min(1.15, t * 1.6);
      material.uniforms.fade!.value = 1 - Math.max(0, t - 0.55) / 0.45;
    });
  }

  /** Sparks where a blow landed. */
  impact(x: number, y: number, colour: THREE.ColorRepresentation, big = false): void {
    this.particles.burst({ x, y: 0.55, z: y, count: big ? 26 : 14, colour, speed: big ? 3.4 : 2.4, life: 0.35, size: 0.12, gravity: 6 });
  }

  /** A creature's end: a puff of dust and a few rising motes. */
  death(x: number, y: number): void {
    this.particles.burst({ x, y: 0.15, z: y, count: 22, colour: 0x9a8a76, speed: 1.6, life: 0.7, size: 0.22, flat: true });
    this.particles.burst({ x, y: 0.5, z: y, count: 10, colour: 0xd8e4ff, speed: 0.4, rise: 1.6, life: 1.1, size: 0.1 });
  }

  /** A ring of light thrown out across the floor. */
  shockwave(x: number, y: number, colour: THREE.ColorRepresentation, size: number, life = 0.6): void {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 64), lightMaterial(this.glow, colour, 1));
    (mesh.material as THREE.MeshBasicMaterial).map = null;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.06, y);
    this.flare(mesh, life, (t) => {
      mesh.scale.setScalar(0.3 + t * size);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    });
  }

  /** Level up: a column of gold light, a ring across the floor and sparks fountaining up. */
  levelUp(x: number, y: number): void {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { t: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float t; varying vec2 vUv;
        void main(){
          float rise = smoothstep(0.0, 0.25, t);
          float body = (1.0 - vUv.y) * step(vUv.y, rise * 1.1);
          float bands = 0.75 + 0.25 * sin(vUv.y * 30.0 - t * 18.0);
          float fade = 1.0 - smoothstep(0.55, 1.0, t);
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.38) * bands, body * fade * 0.85);
        }`,
    });
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.75, 4, 32, 1, true), material);
    column.position.set(x, 2, y);
    this.flare(column, 1.6, (t) => {
      material.uniforms.t!.value = t;
      column.rotation.y += 0.04;
    });
    this.shockwave(x, y, 0xffd27a, 7, 0.9);
    this.shockwave(x, y, 0xfff0c0, 4, 0.6);
    this.particles.burst({ x, y: 0.2, z: y, count: 90, colour: 0xffd27a, speed: 1.6, rise: 4.2, gravity: 2.5, life: 1.5, size: 0.14 });
  }

  /** A pale flash when the hero is hurt. */
  hurt(x: number, y: number): void {
    this.particles.burst({ x, y: 0.6, z: y, count: 12, colour: 0xff5a4a, speed: 2.2, life: 0.4, size: 0.12, gravity: 5 });
  }

  // ---------- shots, spells, clouds ----------

  private orb(colour: THREE.ColorRepresentation, size: number): THREE.Sprite {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.glow, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
    );
    s.scale.setScalar(size);
    s.renderOrder = 6;
    return s;
  }

  private shotMesh(shot: World['shots'][number]): THREE.Object3D {
    if (shot.arrow) {
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0xc8b088 }));
      shaft.rotation.z = Math.PI / 2;
      const tip = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.12, 6),
        new THREE.MeshStandardMaterial({ color: 0xd0d6de, metalness: 0.6 }),
      );
      tip.rotation.z = -Math.PI / 2;
      tip.position.x = 0.3;
      g.add(shaft, tip, this.orb(0xfff2c8, 0.25));
      return g;
    }
    const spinner = new THREE.Mesh(
      shot.mine ? new THREE.TorusGeometry(0.16, 0.045, 6, 16, Math.PI * 1.3) : new THREE.DodecahedronGeometry(0.09),
      new THREE.MeshStandardMaterial({ color: shot.mine ? 0xb48a52 : 0x8a8580, roughness: 0.8 }),
    );
    spinner.castShadow = true;
    return spinner;
  }

  /** Keeps a mesh for every shot, orb, beam and cloud in the world, interpolated by `between`. */
  syncMissiles(w: World, between: number, time: number, dt: number): void {
    const live = new Set<object>();
    for (const shot of w.shots) {
      live.add(shot);
      let mesh = this.shotMeshes.get(shot);
      if (!mesh) {
        mesh = this.shotMesh(shot);
        this.shotMeshes.set(shot, mesh);
        this.group.add(mesh);
      }
      const x = shot.px + (shot.x - shot.px) * between;
      const y = shot.py + (shot.y - shot.py) * between;
      mesh.position.set(x, 0.55, y);
      if (shot.arrow) mesh.rotation.y = -Math.atan2(shot.vy, shot.vx);
      else mesh.rotation.set(Math.PI / 2, time * 14, 0);
    }
    for (const shot of w.spellShots) {
      live.add(shot);
      let mesh = this.shotMeshes.get(shot);
      if (!mesh) {
        mesh = new THREE.Group();
        mesh.add(this.orb(shot.colour, 0.75), this.orb(0xffffff, 0.3));
        const light = new THREE.PointLight(shot.colour, 2.5, 3.5, 1.6);
        mesh.add(light);
        this.shotMeshes.set(shot, mesh);
        this.group.add(mesh);
      }
      const x = shot.px + (shot.x - shot.px) * between;
      const y = shot.py + (shot.y - shot.py) * between;
      mesh.position.set(x, 0.6, y);
      this.particles.mote(x, 0.6, y, shot.colour, 0.16, 0.45);
    }
    for (const [key, mesh] of this.shotMeshes) {
      if (live.has(key)) continue;
      // A spell orb bursts where it ends.
      if (mesh.children.some((c) => (c as THREE.PointLight).isPointLight)) {
        const p = mesh.position;
        const colour = ((mesh.children[0] as THREE.Sprite).material as THREE.SpriteMaterial).color;
        this.particles.burst({ x: p.x, y: p.y, z: p.z, count: 24, colour, speed: 2.6, life: 0.45, size: 0.14 });
      }
      mesh.removeFromParent();
      this.shotMeshes.delete(key);
    }

    const liveClouds = new Set<object>();
    for (const cloud of w.spellClouds) {
      liveClouds.add(cloud);
      let mesh = this.clouds.get(cloud);
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), lightMaterial(this.glow, cloud.colour, 0.55));
        (mesh.material as THREE.MeshBasicMaterial).blending = THREE.NormalBlending;
        mesh.rotation.x = -Math.PI / 2;
        this.clouds.set(cloud, mesh);
        this.group.add(mesh);
      }
      mesh.position.set(cloud.x, 0.08 + Math.sin(time * 2) * 0.02, cloud.y);
      mesh.scale.setScalar(cloud.radius * (1 + Math.sin(time * 3) * 0.04));
      if (Math.random() < dt * 30) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * cloud.radius;
        this.particles.burst({
          x: cloud.x + Math.cos(a) * r,
          y: 0.1,
          z: cloud.y + Math.sin(a) * r,
          count: 1,
          colour: cloud.colour,
          speed: 0.1,
          rise: 0.8,
          life: 1,
          size: 0.3,
        });
      }
    }
    for (const [key, mesh] of this.clouds) {
      if (liveClouds.has(key)) continue;
      mesh.removeFromParent();
      this.clouds.delete(key);
    }

    const liveVisuals = new Set<object>();
    for (const v of w.spellVisuals) {
      liveVisuals.add(v);
      let mesh = this.visuals.get(v);
      if (!mesh) {
        if (v.shape === 'beam') {
          const from = new THREE.Vector3(v.x1, 0.6, v.y1);
          const to = new THREE.Vector3(v.x2, 0.6, v.y2);
          const length = from.distanceTo(to);
          const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, length, 8, 1, true), lightMaterial(this.glow, v.colour, 1));
          (beam.material as THREE.MeshBasicMaterial).map = null;
          beam.position.copy(from).lerp(to, 0.5);
          beam.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
          mesh = beam;
          this.particles.burst({ x: v.x2, y: 0.6, z: v.y2, count: 18, colour: v.colour, speed: 2.4, life: 0.4, size: 0.13 });
        } else {
          mesh = new THREE.Group();
          const disc = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), lightMaterial(this.glow, v.colour, 1));
          (disc.material as THREE.MeshBasicMaterial).map = null;
          disc.rotation.x = -Math.PI / 2;
          mesh.add(disc);
          mesh.position.set(v.x2, 0.08, v.y2);
          mesh.scale.setScalar(v.radius);
          this.particles.burst({
            x: v.x2,
            y: 0.3,
            z: v.y2,
            count: 40,
            colour: v.colour,
            speed: v.radius * 3,
            life: 0.5,
            size: 0.16,
            flat: true,
          });
        }
        this.visuals.set(v, mesh);
        this.group.add(mesh);
      }
      const alpha = Math.min(1, v.left / 0.12);
      mesh.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (m) m.opacity = alpha;
      });
    }
    for (const [key, mesh] of this.visuals) {
      if (liveVisuals.has(key)) continue;
      mesh.removeFromParent();
      this.visuals.delete(key);
    }
  }

  update(dt: number): void {
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i]!;
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) {
        f.object.removeFromParent();
        f.object.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
          }
        });
        this.flares.splice(i, 1);
        continue;
      }
      f.tick(t, dt);
    }
  }

  /** Forgets floor-bound things when the hero changes floor. */
  clearFloor(): void {
    for (const m of this.shotMeshes.values()) m.removeFromParent();
    this.shotMeshes.clear();
  }
}
