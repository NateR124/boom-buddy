import { InputState } from '../input';
import { World } from './world';
import { TerrainGrid, CELL_SCALE, isWater } from '../terrain/grid';
import { resolvePlayerTerrainCollision } from '../terrain/terrainCollision';

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  grounded: boolean;
  facing: 1 | -1;
  // Jump tuning state
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpHeld: boolean;
  jumpCutoff: boolean; // true if player released jump early (cut short)
  // Respawn
  dead: boolean;
  respawnTimer: number;
  invulnTimer: number;
}

// Physics constants
const GRAVITY = 980;
const APEX_GRAVITY_MULT = 0.65; // reduced gravity near jump apex for hang time
const APEX_VY_THRESHOLD = 60;   // |vy| below this counts as "apex"
const RUN_ACCEL = 2800;
const RUN_DECEL = 2200;
const AIR_ACCEL = 1400;
const MAX_RUN_SPEED = 300;
const JUMP_VELOCITY = -540;
const JUMP_CUT_MULTIPLIER = 0.5; // multiply vy when jump released early
const COYOTE_TIME = 0.1; // seconds (~6 frames at 60fps)
const JUMP_BUFFER_TIME = 0.133; // ~8 frames — generous buffer
const RESPAWN_DELAY = 0.5;
const INVULN_TIME = 1.0;

export function createPlayer(x: number, y: number): Player {
  return {
    x, y,
    vx: 0, vy: 0,
    w: 20, h: 40,
    grounded: false,
    facing: 1,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpHeld: false,
    jumpCutoff: false,
    dead: false,
    respawnTimer: 0,
    invulnTimer: 0,
  };
}

/**
 * @param cameraScrollY — current camera scroll Y (for dynamic kill zone)
 */
export function updatePlayer(
  player: Player, input: InputState, world: World, terrain: TerrainGrid,
  dt: number, cameraScrollY: number,
) {
  // Handle respawn timer
  if (player.dead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      respawnPlayer(player, cameraScrollY, world);
    }
    return;
  }

  // Invulnerability countdown
  if (player.invulnTimer > 0) {
    player.invulnTimer -= dt;
  }

  // Horizontal movement
  const accel = player.grounded ? RUN_ACCEL : AIR_ACCEL;
  let moveDir = 0;
  if (input.left) moveDir -= 1;
  if (input.right) moveDir += 1;

  if (moveDir !== 0) {
    player.facing = moveDir as 1 | -1;
    player.vx += moveDir * accel * dt;
    // Clamp speed
    if (Math.abs(player.vx) > MAX_RUN_SPEED) {
      player.vx = Math.sign(player.vx) * MAX_RUN_SPEED;
    }
  } else {
    // Decelerate
    const decel = (player.grounded ? RUN_DECEL : RUN_DECEL * 0.5) * dt;
    if (Math.abs(player.vx) <= decel) {
      player.vx = 0;
    } else {
      player.vx -= Math.sign(player.vx) * decel;
    }
  }

  // Coyote time
  if (player.grounded) {
    player.coyoteTimer = COYOTE_TIME;
  } else {
    player.coyoteTimer -= dt;
  }

  // Jump buffering
  if (input.jumpPressed) {
    player.jumpBufferTimer = JUMP_BUFFER_TIME;
  } else {
    player.jumpBufferTimer -= dt;
  }

  // Jump execution
  if (player.jumpBufferTimer > 0 && player.coyoteTimer > 0) {
    player.vy = JUMP_VELOCITY;
    player.grounded = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
    player.jumpHeld = true;
    player.jumpCutoff = false;
  }

  // Variable jump height: cut velocity only on explicit release
  if (player.jumpHeld && !player.jumpCutoff && input.jumpReleased) {
    if (player.vy < 0) {
      player.vy *= JUMP_CUT_MULTIPLIER;
    }
    player.jumpCutoff = true;
  }

  // Gravity — reduce near apex for hang time feel
  let grav = GRAVITY;
  if (!player.grounded && Math.abs(player.vy) < APEX_VY_THRESHOLD) {
    grav *= APEX_GRAVITY_MULT;
  }
  player.vy += grav * dt;

  // Apply velocity
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Water slowdown: check how many water cells overlap the player
  const waterCells = getPlayerWaterOverlap(player, terrain);
  if (waterCells > 0) {
    const waterFraction = Math.min(waterCells / 20, 1.0); // 20 cells ≈ fully submerged
    const slowFactor = 1.0 - 0.6 * waterFraction; // up to 60% speed reduction
    player.vx *= slowFactor;
    player.vy *= slowFactor; // slows falling too — buoyancy feel
  }

  // Terrain collision
  player.grounded = false;
  resolvePlayerTerrainCollision(player, terrain);

  // Reset jump held when landing
  if (player.grounded) {
    player.jumpHeld = false;
    player.jumpCutoff = false;
  }

  // Dynamic kill zone: side walls + rising ceiling (no bottom — infinite descent)
  if (player.x < -50 || player.x > world.width + 50) {
    killPlayer(player);
  }
  // Rising ceiling: can't go above the camera
  if (player.y < cameraScrollY - 60) {
    killPlayer(player);
  }
}

function killPlayer(player: Player) {
  player.dead = true;
  player.respawnTimer = RESPAWN_DELAY;
  player.vx = 0;
  player.vy = 0;
}

function respawnPlayer(player: Player, cameraScrollY: number, world: World) {
  // Respawn near the top of the visible screen, centered
  player.x = world.width / 2;
  player.y = cameraScrollY + 60;
  player.vx = 0;
  player.vy = 0;
  player.dead = false;
  player.grounded = false;
  player.invulnTimer = INVULN_TIME;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
}

function getPlayerWaterOverlap(player: Player, grid: TerrainGrid): number {
  const halfW = player.w / 2;
  const halfH = player.h / 2;
  const leftG = Math.floor((player.x - halfW) / CELL_SCALE);
  const rightG = Math.floor((player.x + halfW) / CELL_SCALE);
  const topG = Math.floor((player.y - halfH) / CELL_SCALE);
  const botG = Math.floor((player.y + halfH) / CELL_SCALE);

  let count = 0;
  for (let gy = topG; gy <= botG; gy++) {
    for (let gx = leftG; gx <= rightG; gx++) {
      if (isWater(grid, gx, gy)) count++;
    }
  }
  return count;
}
