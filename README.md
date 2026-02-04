# Sunset Brawler: Chaos Beach

A retro-inspired, high-octane Beat 'em Up prototype built with React and HTML5 Canvas. This project features high-speed combat, procedural animations, and a phase-based progression system.

## 🕹️ Controls
- **WASD**: Move your character around the beach.
- **J**: Jab Attack (Fast, low damage, builds combo).
- **K**: Straight Attack (Heavy, high damage, longer reach).
- **L**: Dodge (Grants invincibility frames and repositioning).
- **E**: Special Attack (Unlocked at Phase 3. Charges a radial blast).
- **P / ESC**: Pause Game.

## 🏗️ Architecture Overview

The application is structured into modular components:
1.  **App.tsx**: The React bridge. Manages the high-level game state (Menu vs. Playing), the UI HUD, and triggers audio transitions based on gameplay events.
2.  **GameEngine.ts**: The central hub. Orchestrates the requestAnimationFrame loop, handles collision detection, manages level transitions (phases), and controls the background parallax.
3.  **Entity.ts**: The rendering kernel. Contains the base class for all actors. It handles procedural animation logic (moving body parts based on sine waves and frame cycles) and physics.
4.  **Player.ts / Enemy.ts**: Specialized logic. Extends Entity to handle input mapping (Player) or AI state-machine behaviors like stalking and telegraphing attacks (Enemy).

---

## 🎨 How to Add Sprites

Currently, the game uses **procedural drawing** (rectangles and circles) to define characters. To replace these with actual sprite assets, follow these steps:

### 1. Load the Assets
In `Entity.ts`, create a static image loader or pass an `HTMLImageElement` to the constructor.
```typescript
const playerSprite = new Image();
playerSprite.src = 'assets/sprites/player_sheet.png';
```

### 2. Define the Sprite Mapping
The `ANIMATION_DATA` constant in `Entity.ts` already defines frames and speeds. You can add `sourceX` and `sourceY` to map these to your spritesheet rows.

### 3. Update the `draw` Method
In `Entity.ts`, locate the `draw(ctx)` method. Replace the procedural body part logic (the `drawBox` calls) with `ctx.drawImage`.

**Example Implementation:**
```typescript
// Inside Entity.draw(ctx):
const spriteW = 64; 
const spriteH = 64; 

ctx.drawImage(
  this.spriteImage,           
  this.currentFrame * spriteW,
  this.stateOffsetY,          
  spriteW, spriteH,           
  -this.width / 2, -this.height, 
  this.width, this.height      
);
```

### 4. Adjust the Hitbox
If your sprites have different proportions, update `getHitbox()` and `getAttackHitbox()` in `Entity.ts` to match your new pixel dimensions precisely.
