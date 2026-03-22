
/**
 * SECTION: SPRITE MANAGER
 * Summary: Loads sprite sheets from the public/sprite folder and provides
 * a method to draw individual frames. Handles different grid layouts
 * per sprite sheet (e.g., 1x6 row or 2x3 grid).
 */

export interface SpriteSheetConfig {
  /** Path to the sprite sheet image (relative to public/) */
  path: string;
  /** Total number of frames in the sprite sheet */
  frameCount: number;
  /** Number of columns in the sprite sheet grid */
  columns: number;
  /** Number of rows in the sprite sheet grid */
  rows: number;
}

export class SpriteManager {
  private images: Map<string, HTMLImageElement> = new Map();
  private configs: Map<string, SpriteSheetConfig> = new Map();
  private loaded: Map<string, boolean> = new Map();

  /**
   * Registers and begins loading a sprite sheet.
   */
  register(key: string, config: SpriteSheetConfig) {
    this.configs.set(key, config);
    this.loaded.set(key, false);

    const img = new Image();
    img.src = config.path;
    img.onload = () => {
      this.loaded.set(key, true);
    };
    img.onerror = () => {
      console.warn(`SpriteManager: Failed to load sprite "${key}" from ${config.path}`);
    };
    this.images.set(key, img);
  }

  /**
   * Returns true if the sprite sheet for the given key is loaded and ready.
   */
  isReady(key: string): boolean {
    return this.loaded.get(key) === true;
  }

  /**
   * Draws a specific frame from a sprite sheet onto the canvas.
   * @param ctx - Canvas rendering context
   * @param key - Registered sprite sheet key
   * @param frameIndex - Which frame to draw (0-indexed)
   * @param x - Center X position on canvas
   * @param y - Bottom Y position on canvas (feet position)
   * @param facing - 1 for right, -1 for left
   * @param scale - Size multiplier
   * @param alpha - Opacity (for invincibility flicker)
   */
  drawFrame(
    ctx: CanvasRenderingContext2D,
    key: string,
    frameIndex: number,
    x: number,
    y: number,
    facing: 1 | -1,
    scale: number = 1,
    alpha: number = 1
  ): boolean {
    const img = this.images.get(key);
    const config = this.configs.get(key);
    if (!img || !config || !this.loaded.get(key)) return false;

    const frameW = img.naturalWidth / config.columns;
    const frameH = img.naturalHeight / config.rows;

    // Clamp frame index
    const frame = Math.min(frameIndex, config.frameCount - 1);
    const col = frame % config.columns;
    const row = Math.floor(frame / config.columns);

    const srcX = col * frameW;
    const srcY = row * frameH;

    // Destination size — scale the sprite to look right in the game
    const destW = frameW * scale;
    const destH = frameH * scale;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);

    // Flip horizontally for left-facing
    if (facing === -1) {
      ctx.scale(-1, 1);
    }

    // Draw centered horizontally, anchored at bottom
    ctx.drawImage(
      img,
      srcX, srcY, frameW, frameH,
      -destW / 2, -destH,
      destW, destH
    );

    ctx.restore();
    return true;
  }
}
