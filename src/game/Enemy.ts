
import { Entity } from './Entity';
import { EntityState, Rect } from '../types';

interface Projectile {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
}

/**
 * SECTION: ENEMY CLASS
 * Summary: AI controlled entity with state-machine behaviors. 
 * Includes specialized Boss logic for Phase 3 and Phase 5.
 */
export class Enemy extends Entity {
  private target: Entity | null = null;
  private aiTick: number = 0;
  private color: string;
  isBoss: boolean = false;

  private windupTimer: number = 0;
  private nextAttackType: EntityState = EntityState.ATTACKING_JAB;
  private dodgeCooldown: number = 0;

  // Boss Phase 3 Special (Blast)
  private blastCooldown: number = 0;
  private isChargingBlast: boolean = false;
  private blastChargeTimer: number = 0;
  public blastActive: boolean = false;
  public blastRadius: number = 0;
  readonly MAX_BLAST_RADIUS = 180; 

  // Boss Phase 5 Special (Void Orbs)
  public projectiles: Projectile[] = [];
  private projectileCooldown: number = 0;
  private isCastingProjectiles: boolean = false;
  private castTimer: number = 0;

  constructor(x: number, y: number, color: string = '#ef4444', isBoss: boolean = false, hp: number = 30, scale: number = 1) {
    super(x, y, hp);
    this.speed = (1.5 + Math.random() * 2) * (isBoss ? 0.7 : 1);
    this.color = color;
    this.isBoss = isBoss;
    this.scale = scale;
  }

  setTarget(entity: Entity) {
    this.target = entity;
  }

  /**
   * SECTION: AI BRAIN
   * Summary: Decides when to move, attack, or trigger special abilities based on 
   * distance to player and internal cooldowns.
   */
  updateAI() {
    if (!this.target || this.state === EntityState.HIT || this.state === EntityState.DEAD || this.state === EntityState.DODGING) return;
    if (this.state === EntityState.ATTACKING_JAB || this.state === EntityState.ATTACKING_STRAIGHT || this.state === EntityState.WINDING_UP || this.isChargingBlast || this.blastActive || this.isCastingProjectiles) return;

    this.aiTick++;
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.facing = dx > 0 ? 1 : -1;

    // Boss Ability: Projectiles (Phase 5)
    if (this.isBoss && this.maxHp >= 500 && this.projectileCooldown === 0 && dist > 150) {
      if (Math.random() < 0.02) {
        this.isCastingProjectiles = true;
        this.castTimer = 60;
        this.setState(EntityState.IDLE);
        return;
      }
    }

    // Boss Ability: Blast (Phase 3/5)
    if (this.isBoss && this.blastCooldown === 0 && dist < 180) {
      if (Math.random() < 0.02) {
        this.isChargingBlast = true;
        this.blastChargeTimer = 60;
        this.setState(EntityState.IDLE);
        return;
      }
    }

    // Basic Combat Chase
    if (dist > 80 * this.scale) {
      this.setState(EntityState.WALKING);
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    } else {
      this.setState(EntityState.IDLE);
      if (this.aiTick % (this.isBoss ? 20 : 40) === 0) {
        this.nextAttackType = Math.random() > 0.4 ? EntityState.ATTACKING_JAB : EntityState.ATTACKING_STRAIGHT;
        this.setState(EntityState.WINDING_UP);
        this.windupTimer = 15;
      }
    }
  }

  /**
   * SECTION: DEFENSIVE LOGIC
   * Summary: Random chance to dodge player attacks when in close proximity.
   */
  tryDodge(): boolean {
    if (this.dodgeCooldown > 0 || this.state === EntityState.DEAD || this.state === EntityState.DODGING) return false;
    if (Math.random() < (this.isBoss ? 0.35 : 0.12)) {
      this.setState(EntityState.DODGING);
      this.stateTimer = 25;
      this.invincibleTimer = 25;
      this.dodgeCooldown = 120;
      return true;
    }
    return false;
  }

  /**
   * SECTION: UPDATE LOGIC
   * Summary: Updates projectiles and internal special attack state timers.
   */
  update() {
    if (this.dodgeCooldown > 0) this.dodgeCooldown--;

    if (this.state === EntityState.DODGING) {
      this.x += this.facing * (this.speed * 2.8);
    }

    if (this.state === EntityState.WINDING_UP) {
      this.windupTimer--;
      if (this.windupTimer <= 0) this.setState(this.nextAttackType);
    }

    // Handle Blast Cycle
    if (this.isChargingBlast) {
      this.blastChargeTimer--;
      if (this.blastChargeTimer <= 0) {
        this.isChargingBlast = false;
        this.blastActive = true;
        this.blastRadius = 0;
        this.blastCooldown = 350;
      }
    }
    if (this.blastActive) {
      this.blastRadius += (this.MAX_BLAST_RADIUS * this.scale) / 60;
      if (this.blastRadius > this.MAX_BLAST_RADIUS * this.scale) {
          this.blastActive = false;
          this.blastRadius = 0;
      }
    }
    if (this.blastCooldown > 0) this.blastCooldown--;

    // Handle Projectile Cycle
    if (this.isCastingProjectiles) {
      this.castTimer--;
      if (this.castTimer % 20 === 0 && this.castTimer > 0) {
          const angle = Math.atan2(this.target!.y - this.y, this.target!.x - this.x);
          this.projectiles.push({
              x: this.x,
              y: this.y - 45,
              vx: Math.cos(angle) * 7,
              vy: Math.sin(angle) * 7,
              life: 140
          });
      }
      if (this.castTimer <= 0) {
          this.isCastingProjectiles = false;
          this.projectileCooldown = 450;
      }
    }
    if (this.projectileCooldown > 0) this.projectileCooldown--;

    // Move existing projectiles
    this.projectiles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        // Slight homing
        if (this.target && p.life > 60) {
            const tx = this.target.x - p.x;
            const ty = (this.target.y - 30) - p.y;
            const dist = Math.sqrt(tx*tx + ty*ty);
            p.vx = (p.vx * 0.96) + (tx / dist) * 0.45;
            p.vy = (p.vy * 0.96) + (ty / dist) * 0.45;
        }
        if (p.life <= 0) this.projectiles.splice(idx, 1);
    });

    super.update();
  }

  /**
   * SECTION: RENDERING
   * Summary: Draws Boss-specific warning indicators and ability visuals.
   */
  draw(ctx: CanvasRenderingContext2D) {
    // Projectile visuals
    this.projectiles.forEach(p => {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 20);
        glow.addColorStop(0, '#f472b6');
        glow.addColorStop(1, 'rgba(244, 114, 182, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Special: Blast telegraph and active wave
    if (this.isChargingBlast) {
        // Red ground telegraph circle
        const opacity = Math.abs(Math.sin(Date.now() / 100)) * 0.5;
        ctx.fillStyle = `rgba(239, 68, 68, ${opacity})`;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.MAX_BLAST_RADIUS * this.scale, (this.MAX_BLAST_RADIUS * this.scale) * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.MAX_BLAST_RADIUS * this.scale, (this.MAX_BLAST_RADIUS * this.scale) * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
    }

    if (this.blastActive) {
      const progress = 1 - (this.blastRadius / (this.MAX_BLAST_RADIUS * this.scale));
      ctx.strokeStyle = `rgba(255, 255, 0, ${progress})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, this.blastRadius, this.blastRadius * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Warning UI
    if (this.isChargingBlast || this.isCastingProjectiles) {
        ctx.save();
        ctx.translate(Math.sin(Date.now() / 20) * 4, 0); // Shake boss
        super.draw(ctx);
        ctx.restore();
        ctx.fillStyle = '#ff0000';
        ctx.font = 'bold 12px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('WARNING!', this.x, this.y - this.height * this.scale - 40);
        return;
    }

    super.draw(ctx);
  }

  protected getColor(): string {
    return this.color;
  }
}
