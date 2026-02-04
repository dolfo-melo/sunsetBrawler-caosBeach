
import { Player } from './Player';
import { Enemy } from './Enemy';
import { EntityState, GameStats, PHASE_TARGETS, Rect } from '../types';
import { audioManager } from './AudioManager';

/**
 * SECTION: GAME ENGINE
 * Summary: The heart of the application. Manages the main game loop, 
 * coordinate boundaries, enemy spawning, and collision detection.
 */
export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private player: Player;
  private enemies: Enemy[] = [];
  private keys: Set<string> = new Set();
  private statsCallback: (stats: GameStats) => void;
  
  private chaos: number = 0;
  private phase: number = 1;
  private streak: number = 0; 
  private multiplier: number = 1;
  
  private isRunning: boolean = true;
  private isPaused: boolean = false;
  private animationFrameId: number = 0;
  private isGameOver: boolean = false;
  private isVictory: boolean = false;
  
  private isTransitioning: boolean = false;
  private bossSequenceActive: boolean = false;
  private bossSpawnedForCurrentPhase: boolean = false;

  private hitstopTimer: number = 0;

  // Visual decorations
  private clouds: {x: number, y: number, s: number}[] = [];
  private palms: {x: number, scale: number}[] = [];

  constructor(canvas: HTMLCanvasElement, onStatsUpdate: (stats: GameStats) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Could not get canvas context");
    this.ctx = context;
    this.statsCallback = onStatsUpdate;

    // Initialize player at a starting ground position
    this.player = new Player(100, 450);
    this.spawnEnemies();

    // Setup decorative background elements
    for(let i=0; i<10; i++) {
        this.clouds.push({ x: Math.random() * 800, y: 30 + Math.random() * 120, s: 0.1 + Math.random() * 0.4 });
        this.palms.push({ x: i * 120 + Math.random() * 60, scale: 0.8 + Math.random() * 0.4 });
    }

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.loop();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause();
    if (!this.isPaused) this.keys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  public togglePause() {
    if (this.isGameOver || this.isVictory) return;
    this.isPaused = !this.isPaused;
    this.updateStats();
  }

  /**
   * SECTION: SPAWNING LOGIC
   * Summary: Ensures the world is populated. Enforces a rule of exactly 5 enemies 
   * in high-difficulty phases or boss fights to maintain chaos.
   */
  private spawnEnemies() {
    if (this.isTransitioning || this.bossSequenceActive || this.isVictory) return;
    const count = this.phase >= 3 ? 5 : 2 + this.phase;
    for (let i = 0; i < count; i++) {
      this.spawnReplacement();
    }
  }

  private spawnBoss(hp: number, scale: number) {
    this.bossSequenceActive = true;
    this.bossSpawnedForCurrentPhase = true;
    // Clear old enemies for the grand entrance
    this.enemies = this.enemies.filter(e => e.state === EntityState.DEAD);
    const boss = new Enemy(this.canvas.width + 120, 450, '#fde68a', true, hp, scale);
    boss.setTarget(this.player);
    this.enemies.push(boss);
    
    // Spawn up to 5 total entities including the boss
    while(this.enemies.filter(e => e.state !== EntityState.DEAD).length < 5) {
        this.spawnReplacement();
    }
  }

  /**
   * SECTION: PHYSICS & COMBAT UPDATE
   * Summary: Checks for player/enemy collisions, handles attack hits, 
   * and processes state transitions between game phases.
   */
  private update() {
    if (this.isGameOver || this.isVictory || this.isPaused) return;

    // Hitstop provides impact feedback by briefly freezing the update
    if (this.hitstopTimer > 0) {
      this.hitstopTimer--;
      return;
    }

    this.player.handleInput(this.keys, () => audioManager.playSFX(200, 'sawtooth', 0.5));

    if (this.player.hp <= 0 && !this.isGameOver) {
      this.isGameOver = true;
      this.player.setState(EntityState.DEAD);
      return;
    }

    // Progression logic
    const target = PHASE_TARGETS[this.phase - 1] || 99999;
    if (this.chaos >= target && !this.bossSpawnedForCurrentPhase && !this.isTransitioning) {
        if (this.phase === 3) this.spawnBoss(200, 2);
        else if (this.phase === 5) this.spawnBoss(500, 2.5);
        else this.isTransitioning = true;
    }

    // Handle screen transition (The 'GO' arrow phase)
    if (this.isTransitioning && this.enemies.filter(e => e.state !== EntityState.DEAD).length === 0) {
        if (this.player.x > this.canvas.width - 40) {
            this.phase++;
            this.player.x = 20;
            this.isTransitioning = false;
            this.bossSpawnedForCurrentPhase = false;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50); 
            this.spawnEnemies();
        }
    }

    // Ground Boundaries (800x600 coordinate space)
    this.player.x = Math.max(20, Math.min(this.isTransitioning ? 850 : 780, this.player.x));
    this.player.y = Math.max(250, Math.min(580, this.player.y));
    this.player.update();

    // Player Combat Collision (Normal Attacks)
    const pAttack = this.player.getAttackHitbox();
    if (pAttack) {
      this.enemies.forEach(enemy => {
        if (enemy.state !== EntityState.DEAD && this.checkCollision(pAttack, enemy.getHitbox())) {
          if (!enemy.tryDodge()) {
            const dmg = this.player.state === EntityState.ATTACKING_JAB ? 9 : 18;
            if (enemy.takeDamage(dmg, this.player.facing)) {
              audioManager.playHit();
              this.hitstopTimer = 8;
              this.streak++;
            }
          }
        }
      });
    }

    // Player Special Collision (Radial Blast)
    if (this.player.specialAttackActive) {
      this.enemies.forEach(enemy => {
        if (enemy.state !== EntityState.DEAD) {
          const dist = Math.sqrt(Math.pow(enemy.x - this.player.x, 2) + Math.pow(enemy.y - this.player.y, 2));
          if (dist < this.player.specialAttackRadius) {
            // INCREASED DAMAGE: 12 -> 15 (approx 20% buff)
            if (enemy.takeDamage(15, enemy.x > this.player.x ? 1 : -1)) {
              audioManager.playHit();
            }
          }
        }
      });
    }

    // Enemy AI & Combat Update
    this.enemies.forEach((enemy, idx) => {
      enemy.updateAI();
      enemy.update();

      const eAttack = enemy.getAttackHitbox();
      if (eAttack && this.checkCollision(eAttack, this.player.getHitbox())) {
        if (this.player.takeDamage(6, enemy.facing)) {
          audioManager.playHit();
          this.hitstopTimer = 8;
          this.streak = 0;
        }
      }

      // BOSS SPECIAL COLLISION (PHASE 3: BLAST)
      if (enemy.isBoss && enemy.blastActive) {
        const dist = Math.sqrt(Math.pow(this.player.x - enemy.x, 2) + Math.pow(this.player.y - enemy.y, 2));
        if (dist < enemy.blastRadius && this.player.state !== EntityState.DODGING) {
            this.player.takeDamage(10, this.player.x > enemy.x ? 1 : -1);
            audioManager.playHit();
        }
      }

      // BOSS SPECIAL COLLISION (PHASE 5: VOID PROJECTILES)
      enemy.projectiles.forEach((p, pIdx) => {
          const pDist = Math.sqrt(Math.pow(this.player.x - p.x, 2) + Math.pow((this.player.y - 30) - p.y, 2));
          if (pDist < 25 && this.player.state !== EntityState.DODGING) {
              this.player.takeDamage(15, p.vx > 0 ? 1 : -1);
              enemy.projectiles.splice(pIdx, 1);
              audioManager.playHit();
          }
      });

      // Cleanup dead enemies and update chaos score
      if (enemy.state === EntityState.DEAD && enemy.stateTimer === 0) {
        this.chaos += (enemy.isBoss ? 750 : 20) * this.multiplier;
        if (enemy.isBoss) {
            this.bossSequenceActive = false;
            if (this.phase === 3) { this.player.specialUnlocked = true; this.isTransitioning = true; }
            else if (this.phase === 5) this.isVictory = true;
        }
        this.enemies.splice(idx, 1);
        
        // Ensure 5 enemies stay active in high phases
        const activeCount = this.enemies.filter(e => e.state !== EntityState.DEAD).length;
        const targetCount = this.phase >= 3 ? 5 : 3;
        if (!this.isTransitioning && !this.isVictory && activeCount < targetCount) {
            this.spawnReplacement();
        }
      }
    });

    this.multiplier = Math.min(10, 1 + Math.floor(this.streak / 5));
    this.updateStats();
  }

  private spawnReplacement() {
      const side = Math.random() > 0.5 ? -150 : 950;
      const enemy = new Enemy(side, 250 + Math.random() * 330, this.phase >= 4 ? '#a855f7' : '#ef4444');
      enemy.setTarget(this.player);
      this.enemies.push(enemy);
  }

  /**
   * SECTION: RENDERING PIPELINE
   * Summary: Clears the canvas and draws the layers (Sky -> Ground -> Entities -> HUD Hints).
   */
  private draw() {
    this.ctx.clearRect(0, 0, 800, 600);
    
    // Background Layer: Sky Gradient
    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, 250);
    skyGrad.addColorStop(0, this.phase >= 4 ? '#020617' : '#0369a1');
    skyGrad.addColorStop(1, this.phase >= 4 ? '#1e1b4b' : '#38bdf8');
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, 800, 250);
    
    // Background Layer: Sand Ground
    this.ctx.fillStyle = this.phase >= 4 ? '#1e293b' : '#fde68a';
    this.ctx.fillRect(0, 250, 800, 350);
    
    // Environmental Decor
    this.ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this.clouds.forEach(c => {
        this.ctx.beginPath();
        this.ctx.ellipse(c.x, c.y, 60, 25, 0, 0, Math.PI * 2);
        this.ctx.fill();
        c.x = (c.x + c.s) % 850;
    });

    // Draw all entities sorted by Y coordinate for depth (Z-ordering)
    const ents = [this.player, ...this.enemies].sort((a,b) => a.y - b.y);
    ents.forEach(e => e.draw(this.ctx));
    
    // Navigation hint when screen is cleared
    if (this.isTransitioning && this.enemies.filter(e => e.state !== EntityState.DEAD).length === 0) {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px "Press Start 2P"';
        this.ctx.textAlign = 'right';
        this.ctx.fillText("GO! ->", 780, 400);
    }
  }

  private loop() {
    if (!this.isRunning) return;
    this.update();
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.loop());
  }

  private updateStats() {
    const target = PHASE_TARGETS[this.phase - 1] || 99999;
    this.statsCallback({
      hp: this.player.hp, maxHp: this.player.maxHp, chaos: this.chaos, multiplier: this.multiplier,
      phase: this.phase, streak: this.streak, targetChaos: target,
      specialCooldown: this.player.specialCooldownTimer / this.player.SPECIAL_COOLDOWN_MAX,
      specialUnlocked: this.player.specialUnlocked, isBossActive: this.bossSequenceActive,
      isVictory: this.isVictory, isPaused: this.isPaused
    });
  }

  private checkCollision(r1: Rect, r2: Rect) {
    return r1.x < r2.x + r2.width && r1.x + r1.width > r2.x && r1.y < r2.y + r2.height && r1.y + r1.height > r2.y;
  }

  public cleanup() {
    this.isRunning = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    cancelAnimationFrame(this.animationFrameId);
  }
}
