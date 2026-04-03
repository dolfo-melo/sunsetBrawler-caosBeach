import { EntityState, Rect } from '../types';
import { SpriteManager } from './SpriteManager';

/**
 * SECTION: ANIMATION CONFIGURATION
 * Summary: Defines the frame count, animation speed, and whether the state loops.
 * 'activeFrames' is crucial for combat: it specifies exactly which frames 
 * in an attack animation can deal damage, preventing "active-forever" hitboxes.
 */
export interface AnimationConfig {
  frames: number;
  speed: number;
  loop: boolean;
  activeFrames?: number[]; 
}

export const ANIMATION_DATA: Record<EntityState, AnimationConfig> = {
  [EntityState.IDLE]: { frames: 6, speed: 10, loop: true },
  [EntityState.WALKING]: { frames: 6, speed: 8, loop: true },
  [EntityState.ATTACKING_JAB]: { frames: 6, speed: 5, loop: false, activeFrames: [2, 3] },
  [EntityState.ATTACKING_STRAIGHT]: { frames: 6, speed: 6, loop: false, activeFrames: [2, 3, 4] },
  [EntityState.WINDING_UP]: { frames: 5, speed: 10, loop: true },
  [EntityState.DODGING]: { frames: 4, speed: 5, loop: false },
  [EntityState.HIT]: { frames: 2, speed: 10, loop: false },
  [EntityState.DEAD]: { frames: 5, speed: 12, loop: false },
};

/**
 * Maps an EntityState to a sprite key and optionally overrides the frame count.
 */
export interface SpriteStateMapping {
  spriteKey: string;
  frameCount?: number;
}

export class Entity {
  x: number;
  y: number;
  width: number = 50;
  height: number = 80;
  hp: number;
  maxHp: number;
  state: EntityState = EntityState.IDLE;
  facing: 1 | -1 = 1; 
  speed: number = 4;
  scale: number = 1;
  
  vx: number = 0;
  vy: number = 0;
  
  stateTimer: number = 0;
  invincibleTimer: number = 0;
  
  currentFrame: number = 0;
  animationTick: number = 0;

  /** Optional sprite manager for sprite-based rendering */
  protected spriteManager: SpriteManager | null = null;
  /** Maps EntityState → sprite key for sprite-based rendering */
  protected spriteStateMap: Map<EntityState, SpriteStateMapping> = new Map();
  /** Scale multiplier for the rendered sprite size */
  protected spriteScale: number = 1.0;

  constructor(x: number, y: number, hp: number) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
  }

  /**
   * SECTION: PHYSICS & COLLISION HITBOXES
   * Summary: Calculates the rectangular bounds of the entity for physical collisions.
   * Also calculates the 'Attack Hitbox' which is projected forward when attacking.
   */
  getHitbox(): Rect {
    const w = this.width * this.scale;
    const h = this.height * this.scale;
    // Hitbox is centered on x, anchored at feet (this.y)
    // Shrink hitbox slightly inward so it matches the character body, not full sprite
    const hitW = w * 0.7;
    const hitH = h * 0.85;
    return {
      x: this.x - hitW / 2,
      y: this.y - hitH,
      width: hitW,
      height: hitH
    };
  }

  getAttackHitbox(): Rect | null {
    const config = ANIMATION_DATA[this.state];
    if (!config || !config.activeFrames) return null;
    // Only return a hitbox if the current animation frame is 'active' for damage
    if (!config.activeFrames.includes(this.currentFrame)) return null;

    // Attack reach: Jab is short-range, Straight is longer
    const baseReach = this.state === EntityState.ATTACKING_JAB ? 40 : 60;
    const reach = baseReach * this.scale;
    const hWidth = reach;
    const hHeight = 40 * this.scale;
    const hitW = this.width * this.scale * 0.7;
    
    return {
      x: this.facing === 1 ? this.x + hitW / 4 : this.x - hitW / 4 - hWidth,
      y: this.y - this.height * this.scale * 0.65,
      width: hWidth,
      height: hHeight
    };
  }

  /**
   * SECTION: STATE TRANSITIONING
   * Summary: Switches the internal state and resets animation counters to ensure 
   * animations start from frame 0 when a new action is initiated.
   */
  setState(newState: EntityState) {
    if (this.state === newState && ANIMATION_DATA[this.state].loop) return;
    this.state = newState;
    this.currentFrame = 0;
    this.animationTick = 0;
  }

  /**
   * SECTION: COMBAT LOGIC
   * Summary: Processes incoming damage, applies knockback velocity, and manages 
   * invincibility frames (i-frames) to prevent single-frame death loops.
   */
  takeDamage(amount: number, knockbackDir: number = 0) {
    if (this.invincibleTimer > 0 || this.state === EntityState.DEAD) return false;
    
    this.hp -= amount;
    this.setState(EntityState.HIT);
    this.stateTimer = 15;
    this.invincibleTimer = 30;
    this.vx = knockbackDir * (12 / this.scale); 
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.setState(EntityState.DEAD);
    }
    return true;
  }

  /**
   * SECTION: UPDATE CYCLE
   * Summary: Advances position based on velocity (physics) and increments the 
   * animation frame based on the 'speed' defined in ANIMATION_DATA.
   */
  update() {
    if (this.invincibleTimer > 0) this.invincibleTimer--;
    
    // Simple friction-based physics
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.8;
    this.vy *= 0.8;

    const config = ANIMATION_DATA[this.state];
    this.animationTick++;
    if (this.animationTick >= config.speed) {
      this.animationTick = 0;
      this.currentFrame++;
      if (this.currentFrame >= config.frames) {
        if (config.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = config.frames - 1;
          // Return to IDLE if the non-looping animation (like an attack) finishes
          if (this.state !== EntityState.DEAD) {
            this.setState(EntityState.IDLE);
          }
        }
      }
    }

    if (this.stateTimer > 0) {
      this.stateTimer--;
      if (this.stateTimer === 0 && this.state === EntityState.HIT) {
          this.setState(EntityState.IDLE);
      }
    }
  }

  /**
   * SECTION: RENDERING
   * Summary: Tries sprite-based rendering first; falls back to procedural drawing
   * if no sprite is available for the current state.
   */
  draw(ctx: CanvasRenderingContext2D) {
    // Attempt sprite rendering
    if (this.spriteManager) {
      const mapping = this.spriteStateMap.get(this.state);
      if (mapping && this.spriteManager.isReady(mapping.spriteKey)) {
        const isInvincible = this.invincibleTimer > 0;
        const flickerAlpha = isInvincible ? (Math.floor(Date.now() / 50) % 2 === 0 ? 0.3 : 1) : 1;

        // Draw shadow aligned to feet
        const s = this.scale;
        const shadowW = this.width * s * 0.5;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, shadowW, 5 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // Handle HIT shake
        let drawX = this.x;
        if (this.state === EntityState.HIT) {
          drawX += Math.sin(Date.now() / 20) * 4;
        }

        // Handle DEAD rotation — draw falling sprite
        if (this.state === EntityState.DEAD) {
          const fall = (this.currentFrame / 4);
          ctx.save();
          ctx.translate(drawX, this.y);
          ctx.rotate(fall * Math.PI / 2);
          ctx.translate(0, fall * 20 * s);
          
          this.spriteManager.drawFrame(
            ctx, mapping.spriteKey, this.currentFrame,
            0, 0, this.facing, this.spriteScale, flickerAlpha
          );
          ctx.restore();
        } else {
          this.spriteManager.drawFrame(
            ctx, mapping.spriteKey, this.currentFrame,
            drawX, this.y, this.facing, this.spriteScale, flickerAlpha
          );
        }

        // HP Bar above character — positioned relative to sprite height
        if (this.hp < this.maxHp && this.hp > 0) {
          const spriteH = this.height * this.scale * this.spriteScale;
          const barWidth = 40 * s;
          const barHeight = 4 * s;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(this.x - barWidth/2, this.y - spriteH - 10 * s, barWidth, barHeight);
          ctx.fillStyle = this.hp < 30 ? '#ef4444' : '#22c55e';
          ctx.fillRect(this.x - barWidth/2, this.y - spriteH - 10 * s, (this.hp / this.maxHp) * barWidth, barHeight);
        }
        return;
      }
    }

    // FALLBACK: Procedural drawing for entities without sprites
    this.drawProcedural(ctx);
  }

  /**
   * SECTION: PROCEDURAL RENDERING (FALLBACK)
   * Summary: Instead of static images, characters are built from geometric shapes.
   * Parts move dynamically based on the current state (breathing in IDLE, swinging in ATTACK).
   */
  protected drawProcedural(ctx: CanvasRenderingContext2D) {
    const w = this.width * this.scale;
    const h = this.height * this.scale;
    const s = this.scale;
    
    // Draw Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, w / 1.5, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    const isInvincible = this.invincibleTimer > 0;
    const flickerAlpha = isInvincible ? (Math.floor(Date.now() / 50) % 2 === 0 ? 0.3 : 1) : 1;
    
    ctx.save();
    ctx.globalAlpha = flickerAlpha;
    ctx.translate(this.x, this.y);
    if (this.facing === -1) ctx.scale(-1, 1);

    const isFlashing = isInvincible && Math.floor(Date.now() / 100) % 2 === 0;
    const mainColor = isFlashing ? '#ffffff' : this.getColor();
    ctx.fillStyle = mainColor;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2 * s;
    
    // Procedural part offsets
    let headY = -h + 10 * s;
    let headRot = 0;
    let bodyY = -h + 25 * s;
    let bodyH = h - 35 * s;
    let bodyLean = 0;
    let armLX = -12 * s, armLY = -h + 35 * s; 
    let armRX = 12 * s, armRY = -h + 35 * s;  
    let legLX = -10 * s, legLY = -10 * s;
    let legRX = 10 * s, legRY = -10 * s;

    // Apply motion logic based on state
    switch(this.state) {
      case EntityState.IDLE:
        const breathe = Math.sin(Date.now() / 250) * 2 * s;
        headY += breathe;
        bodyH += breathe;
        armRY += breathe;
        break;
      case EntityState.WALKING:
        const cycle = (this.currentFrame / 6) * Math.PI * 2;
        const walkSin = Math.sin(cycle);
        const walkCos = Math.cos(cycle);
        headY += Math.abs(walkSin) * 3 * s;
        legLX += walkSin * 10 * s;
        legRX -= walkSin * 10 * s;
        legLY -= Math.max(0, walkCos) * 5 * s;
        legRY -= Math.max(0, -walkCos) * 5 * s;
        armRX -= walkSin * 8 * s;
        armLX += walkSin * 8 * s;
        bodyLean = walkSin * 0.05;
        break;
      case EntityState.ATTACKING_JAB:
        bodyLean = 0.1;
        if (this.currentFrame < 2) {
          armRX += this.currentFrame * 15 * s;
        } else {
          armRX += (4 - this.currentFrame) * 10 * s;
        }
        break;
      case EntityState.ATTACKING_STRAIGHT:
        bodyLean = 0.2;
        if (this.currentFrame >= 2) {
          armRX += (this.currentFrame * 12 * s);
          headRot = 0.1;
        }
        break;
      case EntityState.HIT:
        ctx.translate(Math.sin(Date.now() / 20) * 4, 0);
        headY -= 5 * s;
        break;
      case EntityState.DEAD:
        const fall = (this.currentFrame / 4);
        ctx.rotate(fall * Math.PI / 2);
        ctx.translate(0, fall * 20 * s);
        break;
    }

    const drawBox = (x: number, y: number, width: number, height: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, r);
      ctx.fill();
      ctx.stroke();
    };

    // Draw parts in specific Z-order
    drawBox(armLX - 5 * s, armLY, 12 * s, 12 * s, 4 * s);
    drawBox(legLX - 6 * s, legLY, 12 * s, 10 * s, 3 * s);
    drawBox(legRX - 6 * s, legRY, 12 * s, 10 * s, 3 * s);

    ctx.save();
    ctx.rotate(bodyLean);
    drawBox(-w/2, bodyY, w, bodyH, 8 * s);
    ctx.restore();

    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate(headRot);
    drawBox(-w/2 + 5 * s, -20 * s, w - 10 * s, 20 * s, 5 * s);
    
    // Draw Eyes
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(4 * s, -12 * s, 2 * s, 0, Math.PI * 2);
    ctx.arc(14 * s, -12 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = mainColor;
    drawBox(armRX - 5 * s, armRY, 16 * s, 16 * s, 5 * s);
    
    ctx.restore();

    // HP Bar above character
    if (this.hp < this.maxHp && this.hp > 0) {
        const barWidth = 40 * s;
        const barHeight = 4 * s;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(this.x - barWidth/2, this.y - h - 25 * s, barWidth, barHeight);
        ctx.fillStyle = this.hp < 30 ? '#ef4444' : '#22c55e';
        ctx.fillRect(this.x - barWidth/2, this.y - h - 25 * s, (this.hp / this.maxHp) * barWidth, barHeight);
    }
  }

  protected getColor(): string {
    return '#3b82f6';
  }
}