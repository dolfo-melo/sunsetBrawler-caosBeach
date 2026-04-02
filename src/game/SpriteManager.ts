
/**
 * SECTION: SPRITE MANAGER
 * Summary: Loads sprite sheets from the public/sprite folder and provides
 * a method to draw individual frames. Handles different grid layouts
 * per sprite sheet (e.g., 1x6 row or 2x3 grid).
 * Supports per-sprite vertical offset (offsetY) to align animations,
 * and caches extracted frames as ImageBitmap for better performance.
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
  /** Vertical pixel offset to align this animation with others (negative = up) */
  offsetY?: number;
  /** Starting frame index in the grid (to select a specific row). Default: 0 */
  startFrame?: number;
}

export class SpriteManager {
  private images: Map<string, HTMLImageElement> = new Map();
  private configs: Map<string, SpriteSheetConfig> = new Map();
  private loaded: Map<string, boolean> = new Map();
  /** Cache of pre-extracted frame bitmaps: key → frame index → ImageBitmap */
  private frameCache: Map<string, Map<number, ImageBitmap>> = new Map();

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
      // Pre-extract frames into ImageBitmap cache for performance
      this.cacheFrames(key, img, config);
    };
    img.onerror = () => {
      console.warn(`SpriteManager: Failed to load sprite "${key}" from ${config.path}`);
    };
    this.images.set(key, img);
  }

  /**
   * Pre-extracts individual frames from a sprite sheet into ImageBitmap cache.
   * This avoids recalculating source rectangles every draw call.
   */
  private async cacheFrames(key: string, img: HTMLImageElement, config: SpriteSheetConfig) {
    const cache = new Map<number, ImageBitmap>();
    const frameW = img.naturalWidth / config.columns;
    const frameH = img.naturalHeight / config.rows;

    for (let i = 0; i < config.frameCount; i++) {
      const globalFrame = i + (config.startFrame ?? 0);
      const col = globalFrame % config.columns;
      const row = Math.floor(globalFrame / config.columns);
      const sx = col * frameW;
      const sy = row * frameH;

      try {
        const bitmap = await createImageBitmap(img, sx, sy, frameW, frameH);
        cache.set(i, bitmap);
      } catch {
        // Fallback: will use direct drawImage if bitmap creation fails
      }
    }

    this.frameCache.set(key, cache);
  }

  /**
   * Returns true if the sprite sheet for the given key is loaded and ready.
   */
  isReady(key: string): boolean {
    return this.loaded.get(key) === true;
  }

  /**
   * Returns the frame dimensions for a loaded sprite.
   * Useful for aligning hitboxes to actual sprite size.
   */
  getFrameSize(key: string): { width: number; height: number } | null {
    const img = this.images.get(key);
    const config = this.configs.get(key);
    if (!img || !config || !this.loaded.get(key)) return null;
    return {
      width: img.naturalWidth / config.columns,
      height: img.naturalHeight / config.rows,
    };
  }

  /**
   * Returns the configured offsetY for a sprite key (defaults to 0).
   */
  getOffsetY(key: string): number {
    const config = this.configs.get(key);
    return config?.offsetY ?? 0;
  }

  /**
   * Draws a specific frame from a sprite sheet onto the canvas.
   * Uses cached ImageBitmap when available for better performance.
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

    // Destination size — scale the sprite to look right in the game
    const destW = frameW * scale;
    const destH = frameH * scale;

    // Apply per-sprite vertical offset
    const oY = (config.offsetY ?? 0) * scale;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + oY);

    // Flip horizontally for left-facing
    if (facing === -1) {
      ctx.scale(-1, 1);
    }

    // Try using cached ImageBitmap first (faster)
    const cachedFrames = this.frameCache.get(key);
    const cachedBitmap = cachedFrames?.get(frame);

    if (cachedBitmap) {
      // Draw from pre-extracted bitmap (no source rect calculation needed)
      ctx.drawImage(
        cachedBitmap,
        -destW / 2, -destH,
        destW, destH
      );
    } else {
      // Fallback: draw from full sprite sheet
      const globalFrame = frame + (config.startFrame ?? 0);
      const col = globalFrame % config.columns;
      const row = Math.floor(globalFrame / config.columns);
      const srcX = col * frameW;
      const srcY = row * frameH;

      ctx.drawImage(
        img,
        srcX, srcY, frameW, frameH,
        -destW / 2, -destH,
        destW, destH
      );
    }

    ctx.restore();
    return true;
  }
}
