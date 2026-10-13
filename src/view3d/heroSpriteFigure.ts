import * as THREE from 'three';
import { TILE_SIZE } from '../data/tiles';
import { drawHeroFrame, type HeroPose, type HeroSprites } from '../view/heroSprite';
import type { HeroFigure, HeroLook } from './actors';
import { HERO_HEIGHT, TileFigure } from './tileFigures';

/**
 * The hero drawn from a layered 8-facing sprite set (e.g. ?sprite=haven) standing in the 3D world:
 * each frame the 2D view's own drawing (outfit, shield, weapon swing) is painted into a small canvas
 * that the camera-facing figure shows. The sprites carry their own facing, so the figure never mirrors.
 */
export class HeroSpriteFigure extends TileFigure implements HeroFigure {
  private readonly canvas: HTMLCanvasElement;
  private readonly texture: THREE.CanvasTexture;

  constructor(
    private readonly sprites: HeroSprites,
    private readonly pose: HeroPose,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = sprites.meta.size;
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    // A 32-pixel tile stands HERO_HEIGHT tall, so the sprite frame stands in proportion.
    super(texture, texture, (HERO_HEIGHT * sprites.meta.size) / TILE_SIZE);
    this.canvas = canvas;
    this.texture = texture;
    this.sprite.center.set(0.5, 1 - sprites.meta.feet[1] / sprites.meta.size);
  }

  /** Repaints the frame for the hero as it is now: called every frame with the hero's look. */
  async dress(look: HeroLook): Promise<void> {
    if (!look.world) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.imageSmoothingEnabled = false;
    drawHeroFrame(ctx, this.sprites, this.pose, look.world);
    this.texture.needsUpdate = true;
  }

  override face(dx: number, dy: number): void {
    super.face(dx, dy);
    this.facing = -1;
  }

  cast(seconds: number): void {
    this.attack(seconds * 0.5);
  }

  throwAt(seconds: number): void {
    this.attack(seconds * 0.5);
  }

  hop(): void {
    // The jump arc comes from the rules' own hop path.
  }

  cheer(): void {
    this.strike(0.4);
  }

  block(): void {
    this.strike(0.6);
  }
}
