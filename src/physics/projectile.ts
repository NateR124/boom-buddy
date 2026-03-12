import { Platform, World } from './world';

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

export function createChargeState(): ChargeState {
  return {
    charging: false,
    chargeTime: 0,
    chargeType: null,
    spiritRadius: 0,
  };
}

export function getChargeLevel(chargeTime: number): number {
  // 3 levels: 0-0.3s = level 1, 0.3-0.8s = level 2, 0.8s+ = level 3
  if (chargeTime < 0.3) return 1;
  if (chargeTime < 0.8) return 2;
  return 3;
}

export function getChargeNormalized(chargeTime: number): number {
  // 0 to 1 over ~1.2 seconds
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
  // Bigger = slower
  const sizeScale = Math.min(spiritRadius / 40, 1);
  const speed = SPIRIT_BOMB_BASE_SPEED * (1 - sizeScale * 0.6);

  // Launch at 45° downward in facing direction
  const angle = facing === 1 ? Math.PI * 0.25 : Math.PI * 0.75;

  return {
    x: px,
    y: py - 30,
    vx: Math.cos(angle) * speed * facing,
    vy: Math.abs(Math.sin(angle) * speed),
    radius: spiritRadius,
    power: Math.min(chargeTime / 3, 1),
    type: 'spirit_bomb',
    alive: true,
    level: 0,
  };
}

export function updateProjectiles(projectiles: Projectile[], world: World, dt: number): Projectile[] {
  const hits: { proj: Projectile; hitX: number; hitY: number }[] = [];

  for (const proj of projectiles) {
    if (!proj.alive) continue;

    // Spirit bombs have gravity
    if (proj.type === 'spirit_bomb') {
      proj.vy += 200 * dt;
    }

    proj.x += proj.vx * dt;
    proj.y += proj.vy * dt;

    // Check platform collision
    for (const plat of world.platforms) {
      if (projectileHitsPlatform(proj, plat)) {
        proj.alive = false;
        hits.push({ proj, hitX: proj.x, hitY: proj.y });
        break;
      }
    }

    // Kill zone
    if (
      proj.x < world.killZone.left ||
      proj.x > world.killZone.right ||
      proj.y > world.killZone.bottom ||
      proj.y < world.killZone.top
    ) {
      proj.alive = false;
    }
  }

  return hits.map(h => h.proj);
}

function projectileHitsPlatform(proj: Projectile, plat: Platform): boolean {
  // Circle vs AABB
  const cx = Math.max(plat.x, Math.min(proj.x, plat.x + plat.w));
  const cy = Math.max(plat.y, Math.min(proj.y, plat.y + plat.h));
  const dx = proj.x - cx;
  const dy = proj.y - cy;
  return (dx * dx + dy * dy) < (proj.radius * proj.radius);
}
