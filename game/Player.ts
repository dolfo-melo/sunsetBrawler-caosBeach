
import { Entity } from './Entity';
import { EntityState } from '../types';

/**
 * SECTION: PLAYER CLASS
 * Summary: Specialized entity that handles user input and unique abilities.
 * Includes the "Chaos Pulse" special attack which is a high-damage radial blast.
 */
export class Player extends Entity {
  specialUnlocked: boolean = false;
  specialCooldownTimer: number = 0;
  readonly SPECIAL_COOLDOWN_MAX = 60 * 15; // 15 seconds at 60fps

  isChargingSpecial: boolean = false;
  specialChargeTimer: number = 0;
  readonly SPECIAL_CHARGE_MAX = 45; 
  
  specialAttackActive: boolean = false;
  specialAttackRadius: number = 0;
  specialActiveTimer: number = 0;
  readonly SPECIAL_ACTIVE_MAX = 60; 
  readonly MAX_SPECIAL_RADIUS = 250; 

  constructor(x: number, y: number) {
    super(x, y, 100);
    this.speed = 5.5;
  }

  /**
   * SECTION: UPDATE LOGIC
   * Summary: Manages the lifecycle of the special attack: 
   * Charging (Telegraph) -> Active (Damage) -> Cooldown.
   */
  update() {
    if (this.isChargingSpecial) {
      this.specialChargeTimer--;
      if (this.specialChargeTimer <= 0) {
        this.isChargingSpecial = false;
        this.specialAttackActive = true;
        this.specialAttackRadius = 0;
        this.specialActiveTimer = this.SPECIAL_ACTIVE_MAX;
      }
    } else if (this.specialAttackActive) {
      // Radial expansion of the damage zone
      this.specialAttackRadius += this.MAX_SPECIAL_RADIUS / (this.SPECIAL_ACTIVE_MAX / 1.5); 
      if (this.specialAttackRadius > this.MAX_SPECIAL_RADIUS) this.specialAttackRadius = this.MAX_SPECIAL_RADIUS;
      
      this.specialActiveTimer--;
      if (this.specialActiveTimer <= 0) {
        this.specialAttackActive = false;
        this.specialAttackRadius = 0;
      }
    }

    super.update();
    if (this.specialCooldownTimer > 0) {
      this.specialCooldownTimer--;
    }
  }

  /**
   * SECTION: INPUT HANDLING
   * Summary: Maps keys to movements and combat actions.
   */
  handleInput(keys: Set<string>, onSpecial: () => void) {
    // Prevent movement while stunned, dead, or channeling special
    if (this.state === EntityState.HIT || this.state === EntityState.DEAD || this.isChargingSpecial || this.specialAttackActive) return;

    // Trigger Special [E]
    if (keys.has('KeyE') && this.specialUnlocked && this.specialCooldownTimer === 0) {
      this.isChargingSpecial = true;
      this.specialChargeTimer = this.SPECIAL_CHARGE_MAX;
      this.setState(EntityState.IDLE);
      this.specialCooldownTimer = this.SPECIAL_COOLDOWN_MAX;
      onSpecial();
      return;
    }

    // Trigger Dodge [L]
    if (keys.has('KeyL') && this.state !== EntityState.DODGING) {
      this.setState(EntityState.DODGING);
      this.invincibleTimer = 35;
      return;
    }

    if (this.state === EntityState.DODGING) {
      this.x += this.facing * this.speed * 2.8;
      return;
    }

    // Attack inputs
    const isAttacking = this.state === EntityState.ATTACKING_JAB || this.state === EntityState.ATTACKING_STRAIGHT;
    if (!isAttacking) {
        if (keys.has('KeyJ')) {
            this.setState(EntityState.ATTACKING_JAB);
            return;
        } else if (keys.has('KeyK')) {
            this.setState(EntityState.ATTACKING_STRAIGHT);
            return;
        }
    }

    // Directional Movement
    let dx = 0;
    let dy = 0;
    if (keys.has('KeyW')) dy -= 1;
    if (keys.has('KeyS')) dy += 1;
    if (keys.has('KeyA')) dx -= 1;
    if (keys.has('KeyD')) dx += 1;

    if (dx !== 0 || dy !== 0) {
      if (dx !== 0 && !isAttacking) this.facing = dx > 0 ? 1 : -1;
      const length = Math.sqrt(dx * dx + dy * dy);
      this.x += (dx / length) * this.speed;
      this.y += (dy / length) * this.speed;

      if (!isAttacking) {
        this.setState(EntityState.WALKING);
      }
    } else {
      if (!isAttacking) {
        this.setState(EntityState.IDLE);
      }
    }
  }

  /**
   * SECTION: RENDERING
   * Summary: Adds visual effects for special attacks including 
   * a preview zone during charging and a glowing blast wave.
   */
  draw(ctx: CanvasRenderingContext2D) {
    // Draw telegraph preview while charging
    if (this.isChargingSpecial) {
      const pulse = Math.abs(Math.sin(Date.now() / 80)) * 20;
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.setLineDash([10, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.MAX_SPECIAL_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 30, 40 + pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw active blast wave
    if (this.specialAttackActive) {
      const progress = 1 - (this.specialActiveTimer / this.SPECIAL_ACTIVE_MAX);
      const opacity = 1 - progress;
      const grad = ctx.createRadialGradient(this.x, this.y - 30, 0, this.x, this.y - 30, this.specialAttackRadius);
      grad.addColorStop(0, `rgba(168, 85, 247, ${opacity * 0.8})`);
      grad.addColorStop(0.8, `rgba(168, 85, 247, ${opacity * 0.4})`);
      grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 30, this.specialAttackRadius, 0, Math.PI * 2);
      ctx.fill();

      // Shockwave ring
      ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 30, this.specialAttackRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    super.draw(ctx);
  }

  protected getColor(): string {
    if (this.isChargingSpecial) return '#ffffff';
    return '#3b82f6';
  }
}
