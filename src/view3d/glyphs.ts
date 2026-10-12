import * as THREE from 'three';

/** Runes drawn round the circle: simple strokes that read as script at any size. */
const RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ'];

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D 캔버스를 만들 수 없다');
  return [c, ctx];
}

function texture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The outer ring of a magic circle: double rings, ticks and a band of runes. White on clear; tinted by material. */
export function circleRingTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, g] = canvas(S);
  const m = S / 2;
  g.translate(m, m);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 10;
  const ring = (r: number, w: number): void => {
    g.lineWidth = w;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
  };
  ring(m * 0.97, 5);
  ring(m * 0.9, 2);
  ring(m * 0.72, 3);
  ring(m * 0.68, 1.5);
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    g.lineWidth = long ? 3 : 1.5;
    g.beginPath();
    g.moveTo(Math.cos(a) * m * 0.9, Math.sin(a) * m * 0.9);
    g.lineTo(Math.cos(a) * m * (long ? 0.83 : 0.87), Math.sin(a) * m * (long ? 0.83 : 0.87));
    g.stroke();
  }
  g.font = `bold ${Math.round(S * 0.07)}px serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let i = 0; i < RUNES.length; i++) {
    const a = (i / RUNES.length) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.translate(0, -m * 0.795);
    g.fillText(RUNES[i]!, 0, 0);
    g.restore();
  }
  return texture(c);
}

/** The inner figure: two interlocked triangles, a circle at each point and a bright core. */
export function circleSigilTexture(): THREE.CanvasTexture {
  const S = 512;
  const [c, g] = canvas(S);
  const m = S / 2;
  g.translate(m, m);
  g.strokeStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 12;
  g.lineWidth = 4;
  const r = m * 0.66;
  for (const turn of [0, Math.PI]) {
    g.beginPath();
    for (let k = 0; k <= 3; k++) {
      const a = turn + (k / 3) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.lineWidth = 2.5;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
    g.beginPath();
    g.arc(Math.cos(a) * r, Math.sin(a) * r, m * 0.07, 0, Math.PI * 2);
    g.stroke();
  }
  g.beginPath();
  g.arc(0, 0, m * 0.33, 0, Math.PI * 2);
  g.stroke();
  const core = g.createRadialGradient(0, 0, 0, 0, 0, m * 0.3);
  core.addColorStop(0, 'rgba(255,255,255,0.55)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = core;
  g.beginPath();
  g.arc(0, 0, m * 0.3, 0, Math.PI * 2);
  g.fill();
  return texture(c);
}

/** A soft round glow, for spell orbs and light pools. */
export function glowTexture(): THREE.CanvasTexture {
  const S = 128;
  const [c, g] = canvas(S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return texture(c);
}

/** A material that draws a white texture as coloured light. */
export function lightMaterial(map: THREE.Texture, colour: THREE.ColorRepresentation, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    color: colour,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
