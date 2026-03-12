import { InputState } from '../input';
import { World } from './world';
import { TerrainGrid } from '../terrain/grid';
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

export function updatePlayer(player: Player, input: InputState, world: World, terrain: TerrainGrid, dt: number) {
  // Handle respawn timer
  if (player.dead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      respawnPlayer(player, world);
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
  // Using jumpReleased (not !input.jump) prevents a fast tap from
  // triggering jump + immediately cutting it in the same frame.
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

  // Terrain collision
  player.grounded = false;
  resolvePlayerTerrainCollision(player, terrain);

  // Reset jump held when landing
  if (player.grounded) {
    player.jumpHeld = false;
    player.jumpCutoff = false;
  }

  // Kill zone check
  if (
    player.x < world.killZone.left ||
    player.x > world.killZone.right ||
    player.y > world.killZone.bottom
  ) {
    killPlayer(player);
  }
}

function killPlayer(player: Player) {
  player.dead = true;
  player.respawnTimer = RESPAWN_DELAY;
  player.vx = 0;
  player.vy = 0;
}

function respawnPlayer(player: Player, world: World) {
  // Random position above main platform
  const mainPlat = world.platforms[0];
  player.x = mainPlat.x + Math.random() * mainPlat.w;
  player.y = mainPlat.y - 120;
  player.vx = 0;
  player.vy = 0;
  player.dead = false;
  player.grounded = false;
  player.invulnTimer = INVULN_TIME;
  player.coyoteTimer = 0;
  player.jumpBufferTimer = 0;
}
