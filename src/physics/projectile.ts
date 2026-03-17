import { World } from './world';
import { TerrainGrid, carveExplosion, CarveResult } from '../terrain/grid';
import { projectileHitsTerrain } from '../terrain/terrainCollision';

export type ProjectileType = 'charge_shot' | 'spirit_bomb';

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
}

export interface ChargeState {
  charging: boolean;
  chargeTime: number;
  chargeType: 'mega' | 'spirit' | null;
  // Spirit bomb visual state
  spiritRadius: number;
}

const CHARGE_SHOT_SPEED = 600;
const SPIRIT_BOMB_BASE_SPEED = 200;

// Spirit bomb positioning: bottom of sphere sits this far above the player center
const SPIRIT_BOMB_GAP = 20;

// Area growth: linear base + slight quadratic acceleration
const SPIRIT_BOMB_AREA_PER_SEC = 3000;
const SPIRIT_BOMB_AREA_ACCEL = 800; // px²/s² — subtle ramp-up over time
const SPIRIT_BOMB_INITIAL_RADIUS = 5;

/**
 * Compute spirit bomb radius from charge time.
 */
export function getSpiritBombRadius(chargeTime: number): number {
  const a0 = Math.PI * SPIRIT_BOMB_INITIAL_RADIUS * SPIRIT_BOMB_INITIAL_RADIUS;
  const area = a0 + SPIRIT_BOMB_AREA_PER_SEC * chargeTime + 0.5 * SPIRIT_BOMB_AREA_ACCEL * chargeTime * chargeTime;
  return Math.sqrt(area / Math.PI);
}

/**
 * Get the center Y of the spirit bomb given player Y and current radius.
 */
export function getSpiritBombCenterY(playerY: number, radius: number): number {
  return playerY - SPIRIT_BOMB_GAP - radius;
}

export function createChargeState(): ChargeState {
  return {
    charging: false,
    chargeTime: 0,
    chargeType: null,
    spiritRadius: 0,
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
  };
}

export function fireSpiritBomb(
  chargeTime: number,
  spiritRadius: number,
  px: number, py: number,
  facing: number,
): Projectile {
  const sizeScale = spiritRadius / 60;
  const speed = SPIRIT_BOMB_BASE_SPEED / (1 + sizeScale * 1.5);

  const centerY = getSpiritBombCenterY(py, spiritRadius);
  const diag = speed * Math.SQRT1_2;

  return {
    x: px,
    y: centerY,
    vx: facing * diag,
    vy: diag, // downward at 45°
    radius: spiritRadius,
    power: chargeTime / 3,
    type: 'spirit_bomb',
    alive: true,
    level: 0,
  };
}

export function getCraterRadius(proj: Projectile): number {
  if (proj.type === 'spirit_bomb') {
    return proj.radius * 1.5;
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

    // Spirit bombs have gravity
    if (proj.type === 'spirit_bomb') {
      proj.vy += 200 * dt;
    }

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
