
export enum EntityState {
  IDLE = 'IDLE',
  WALKING = 'WALKING',
  ATTACKING_JAB = 'ATTACKING_JAB',
  ATTACKING_STRAIGHT = 'ATTACKING_STRAIGHT',
  WINDING_UP = 'WINDING_UP',
  DODGING = 'DODGING',
  HIT = 'HIT',
  DEAD = 'DEAD'
}

export interface GameStats {
  hp: number;
  maxHp: number;
  chaos: number;
  multiplier: number;
  phase: number;
  streak: number;
  targetChaos: number;
  specialCooldown: number; // 0 to 1
  specialUnlocked: boolean;
  isBossActive: boolean;
  isVictory: boolean;
  isPaused: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PHASE_TARGETS = [100, 1000, 3000, 5000, 10000];
