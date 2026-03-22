import { World } from './world';
import { TerrainGrid, carveExplosion, CarveResult } from '../terrain/grid';
import { projectileHitsTerrain } from '../terrain/terrainCollision';
import { BombConfig, createDefaultBombConfig } from './bombConfig';

export type ProjectileType = 'charge_shot' | 'spirit_bomb';

// Active bomb config — mutable so the debug panel can swap it
let bombConfig: BombConfig = createDefaultBombConfig();

export function setBombConfig(cfg: BombConfig): void {
  bombConfig = cfg;
}

/** Base max charge time in seconds (without any purple balls) */
const BASE_MAX_CHARGE = 5.0;

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  power: number;       // 0-1, affects crater size and explosion
  type: ProjectileType;
  alive: boolean;
  level: number;       // charge level 1-3 for charge shot, continuous for spirit bomb
  windStacks: number;  // Wind Ball stacks at time of firing
  windModifier: number; // wind ball modifier at time of firing
  purpleOvercharge: number; // 0–1 visual purple shift
}

export interface ChargeState {
  charging: boolean;
  chargeTime: number;
  chargeType: 'mega' | 'spirit' | null;
  // Spirit bomb visual state
  spiritRadius: number;
  // Target position for thrown bomb (world coords)
  targetX: number;
  targetY: number;
}

const CHARGE_SHOT_SPEED = 600;
const SPIRIT_BOMB_BASE_SPEED = 1800;

// Spirit bomb positioning: bottom of sphere sits this far above the player center
const SPIRIT_BOMB_GAP = 20;

const SPIRIT_BOMB_INITIAL_RADIUS = 18;

/** Get the max charge time given purple ball stacks and per-stack bonus */
export function getMaxChargeTime(purpleStacks: number, bonusPerStack: number): number {
  return BASE_MAX_CHARGE + purpleStacks * bonusPerStack;
}

/** Purple visual: 0 at vanilla max or below, ramps to 1.0 over the next 30 bonus units of charge.
 *  Each purple ball adds `bonusPerStack` to max charge. The visual shift spans
 *  from X+1 bonus (first hint of purple) to X+30 bonus (fully purple). */
const PURPLE_VISUAL_SPAN = 30; // number of bonus charge units to reach full purple

export function getPurpleOvercharge(chargeTime: number, _purpleStacks: number, bonusPerStack: number): number {
  if (chargeTime <= BASE_MAX_CHARGE) return 0;
  const overTime = chargeTime - BASE_MAX_CHARGE; // how far past vanilla max
  // Each purple ball adds bonusPerStack seconds. Full purple at 30 * bonusPerStack above vanilla.
  const fullPurpleTime = PURPLE_VISUAL_SPAN * bonusPerStack;
  if (fullPurpleTime <= 0) return 0;
  return Math.min(overTime / fullPurpleTime, 1);
}

/**
 * Compute spirit bomb radius from charge time.
 */
export function getSpiritBombRadius(chargeTime: number): number {
  const a0 = Math.PI * SPIRIT_BOMB_INITIAL_RADIUS * SPIRIT_BOMB_INITIAL_RADIUS;
  const area = a0 + bombConfig.chargeSpeed * chargeTime + 0.5 * bombConfig.chargeAcceleration * chargeTime * chargeTime;
  return Math.sqrt(area / Math.PI);
}

/**
 * Get the center Y of the spirit bomb given player Y and current radius.
 * @deprecated Use getSpiritBombCenter for directional aiming
 */
export function getSpiritBombCenterY(playerY: number, radius: number): number {
  return playerY - SPIRIT_BOMB_GAP - radius;
}

/**
 * Get the center position of the spirit bomb based on aim direction.
 */
export function getSpiritBombCenter(
  playerX: number, playerY: number,
  radius: number,
  aimDirX: number, aimDirY: number,
): { x: number; y: number } {
  const len = Math.sqrt(aimDirX * aimDirX + aimDirY * aimDirY);
  const dx = len > 0.01 ? aimDirX / len : 0;
  const dy = len > 0.01 ? aimDirY / len : -1;
  const dist = SPIRIT_BOMB_GAP + radius;
  return {
    x: playerX + dx * dist,
    y: playerY + dy * dist,
  };
}

export function createChargeState(): ChargeState {
  return {
    charging: false,
    chargeTime: 0,
    chargeType: null,
    spiritRadius: 0,
    targetX: 0,
    targetY: 0,
  };
}

export function getChargeLevel(chargeTime: number): number {
  if (chargeTime < 0.3) return 1;
  if (chargeTime < 0.8) return 2;
  return 3;
}

export function getChargeNormalized(chargeTime: number): number {
  return Math.min(chargeTime / 1.2, 1);
}

export function fireChargeShot(
  chargeTime: number,
  px: number, py: number,
  facing: number,
): Projectile {
  const level = getChargeLevel(chargeTime);
  const radius = level === 1 ? 4 : level === 2 ? 7 : 12;
  const power = level / 3;

  return {
    x: px + facing * 15,
    y: py - 5,
    vx: facing * CHARGE_SHOT_SPEED,
    vy: 0,
    radius,
    power,
    type: 'charge_shot',
    alive: true,
    level,
    windStacks: 0,
    windModifier: 0,
    purpleOvercharge: 0,
  };
}

export function fireSpiritBomb(
  chargeTime: number,
  spiritRadius: number,
  launchX: number, launchY: number,
  targetX: number, targetY: number,
  windStacks = 0,
  windModifier = 0,
  purpleOvercharge = 0,
): Projectile {
  const sizeScale = spiritRadius / 60;
  const speed = SPIRIT_BOMB_BASE_SPEED / (1 + sizeScale * bombConfig.fallSpeedSizeDebuff);

  // Aim toward target from launch position
  const dx = targetX - launchX;
  const dy = targetY - launchY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  let vx: number, vy: number;
  if (dist > 1) {
    vx = (dx / dist) * speed;
    vy = (dy / dist) * speed;
  } else {
    vx = 0;
    vy = speed;
  }

  const power = chargeTime / 3;

  return {
    x: launchX,
    y: launchY,
    vx,
    vy,
    radius: spiritRadius,
    power,
    type: 'spirit_bomb',
    alive: true,
    level: 0,
    windStacks,
    windModifier,
    purpleOvercharge,
  };
}

export function getCraterRadius(proj: Projectile): number {
  if (proj.type === 'spirit_bomb') {
    return proj.radius * 2.25;
  }
  return 8 + proj.power * 24;
}

export interface ProjectileHit {
  proj: Projectile;
  carve: CarveResult;
}

/**
 * @param cameraScrollY — current camera scroll Y for dynamic kill zone
 */
export function updateProjectiles(
  projectiles: Projectile[], world: World, terrain: TerrainGrid,
  dt: number, cameraScrollY: number,
): ProjectileHit[] {
  const hits: ProjectileHit[] = [];

  for (const proj of projectiles) {
    if (!proj.alive) continue;

    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    // Check terrain collision
    if (projectileHitsTerrain(proj, terrain)) {
      proj.alive = false;
      const craterR = getCraterRadius(proj);
      const carve = carveExplosion(terrain, proj.x, proj.y, craterR);
      hits.push({ proj, carve });
    }

    // Dynamic kill zone: side walls + way above camera (no bottom limit)
    if (
      proj.x < -200 ||
      proj.x > world.width + 200 ||
      proj.y < cameraScrollY - 800
    ) {
      proj.alive = false;
    }
  }

  return hits;
}
