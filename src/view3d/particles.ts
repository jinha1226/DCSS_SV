import * as THREE from 'three';

const MAX = 3000;

export interface Burst {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly count: number;
  readonly colour: THREE.ColorRepresentation;
  /** Outward speed, world units per second. */
  readonly speed: number;
  /** Upward push added to every particle. */
  readonly rise?: number;
  readonly gravity?: number;
  readonly life: number;
  readonly size: number;
  /** Flatten the spray onto the ground plane (rings, dust). */
  readonly flat?: boolean;
}

/** One draw call of additive glowing points with CPU-side motion. */
export class Particles {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly vel = new Float32Array(MAX * 3);
  private readonly col = new Float32Array(MAX * 3);
  private readonly size = new Float32Array(MAX);
  private readonly alpha = new Float32Array(MAX);
  private readonly life = new Float32Array(MAX);
  private readonly age = new Float32Array(MAX);
  private readonly grav = new Float32Array(MAX);
  private next = 0;
  private readonly colour = new THREE.Color();

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('colour', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { scale: { value: 400 } },
      vertexShader: `
        attribute vec3 colour;
        attribute float size;
        attribute float alpha;
        uniform float scale;
        varying vec3 vColour;
        varying float vAlpha;
        void main() {
          vColour = colour;
          vAlpha = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColour;
        varying float vAlpha;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = length(d) * 2.0;
          float glow = smoothstep(1.0, 0.0, r);
          gl_FragColor = vec4(vColour * glow * (1.0 + glow), vAlpha * glow);
        }`,
    });
    this.points = new THREE.Points(g, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** Keeps points the same size on screen whatever the canvas height. */
  setScreenHeight(px: number): void {
    (this.points.material as THREE.ShaderMaterial).uniforms.scale!.value = px * 0.5;
  }

  burst(b: Burst): void {
    this.colour.set(b.colour);
    for (let n = 0; n < b.count; n++) {
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const a = Math.random() * Math.PI * 2;
      const up = b.flat ? 0 : Math.random() * 2 - 0.4;
      const s = b.speed * (0.4 + Math.random() * 0.6);
      this.pos.set([b.x, b.y, b.z], i * 3);
      this.vel.set([Math.cos(a) * s, up * s * 0.6 + (b.rise ?? 0), Math.sin(a) * s], i * 3);
      const v = 0.75 + Math.random() * 0.5;
      this.col.set([this.colour.r * v, this.colour.g * v, this.colour.b * v], i * 3);
      this.size[i] = b.size * (0.6 + Math.random() * 0.8);
      this.life[i] = b.life * (0.6 + Math.random() * 0.6);
      this.age[i] = 0;
      this.grav[i] = b.gravity ?? 0;
      this.alpha[i] = 1;
    }
  }

  /** A single drifting mote, for trails behind spells. */
  mote(x: number, y: number, z: number, colour: THREE.ColorRepresentation, size: number, life: number): void {
    this.burst({ x, y, z, count: 1, colour, speed: 0.25, life, size });
  }

  update(dt: number): void {
    for (let i = 0; i < MAX; i++) {
      if (this.alpha[i]! <= 0) continue;
      this.age[i]! += dt;
      const t = this.age[i]! / this.life[i]!;
      if (t >= 1) {
        this.alpha[i] = 0;
        continue;
      }
      this.vel[i * 3 + 1]! -= this.grav[i]! * dt;
      const drag = 1 - Math.min(1, dt * 2.2);
      for (let k = 0; k < 3; k++) {
        this.vel[i * 3 + k]! *= drag;
        this.pos[i * 3 + k]! += this.vel[i * 3 + k]! * dt;
      }
      this.alpha[i] = 1 - t * t;
    }
    const g = this.points.geometry;
    g.getAttribute('position').needsUpdate = true;
    g.getAttribute('colour').needsUpdate = true;
    g.getAttribute('size').needsUpdate = true;
    g.getAttribute('alpha').needsUpdate = true;
  }
}
