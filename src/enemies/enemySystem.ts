import { EnemyConfig } from './enemyConfig';

export interface Enemy {
  x: number;
  y: number;
  alive: boolean;
  fromLeft: boolean; // which side it came from
}

export interface EnemySystem {
  enemies: Enemy[];
  lastSpawnDepth: number; // last depth (scrollY) at which we checked spawning
  kills: number;
}

export function createEnemySystem(): EnemySystem {
  return {
    enemies: [],
    lastSpawnDepth: 0,
    kills: 0,
  };
}

/**
 * Spawn new bats based on player descent.
 */
export function spawnEnemies(
  sys: EnemySystem,
  scrollY: number,
  canvasWidth: number,
  canvasHeight: number,
  config: EnemyConfig,
): void {
  // Check how many spawn intervals we've passed
  while (scrollY - sys.lastSpawnDepth >= config.spawnInterval) {
    sys.lastSpawnDepth += config.spawnInterval;

    const depth = sys.lastSpawnDepth;
    const chance = Math.min(config.baseSpawnChance + (depth / 1000) * config.depthChanceBonus, 0.95);

    if (Math.random() > chance) continue;

    const count = config.minPerSpawn + Math.floor(Math.random() * (config.maxPerSpawn - config.minPerSpawn + 1));

    for (let i = 0; i < count; i++) {
      const fromLeft = Math.random() < 0.5;
      const x = fromLeft ? -20 : canvasWidth + 20;
      // Spawn within the visible vertical range, offset by scroll
      const y = scrollY + canvasHeight * 0.2 + Math.random() * canvasHeight * 0.6;

      sys.enemies.push({ x, y, alive: true, fromLeft });
    }
  }
}

/**
 * Move bats toward the player.
 */
export function updateEnemies(
  sys: EnemySystem,
  playerX: number,
  playerY: number,
  dt: number,
  config: EnemyConfig,
): void {
  for (const e of sys.enemies) {
    if (!e.alive) continue;

    const dx = playerX - e.x;
    const dy = playerY - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) continue;

    e.x += (dx / dist) * config.batSpeed * dt;
    e.y += (dy / dist) * config.batSpeed * dt;
  }
}

/**
 * Check if any enemy overlaps the player hitbox. Returns damage count.
 */
export function checkEnemyPlayerCollision(
  sys: EnemySystem,
  px: number, py: number,
  pw: number, ph: number,
): number {
  let hits = 0;
  const halfW = pw / 2;
  const halfH = ph / 2;

  for (const e of sys.enemies) {
    if (!e.alive) continue;
    if (
      e.x > px - halfW - 8 &&
      e.x < px + halfW + 8 &&
      e.y > py - halfH - 8 &&
      e.y < py + halfH + 8
    ) {
      e.alive = false;
      hits++;
    }
  }
  return hits;
}

/**
 * Check if any projectile explosion hits enemies. Mark them dead and count kills.
 */
export function damageEnemiesInRadius(
  sys: EnemySystem,
  cx: number, cy: number,
  radius: number,
): number {
  let killed = 0;
  for (const e of sys.enemies) {
    if (!e.alive) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    if (dx * dx + dy * dy < radius * radius) {
      e.alive = false;
      killed++;
      sys.kills++;
    }
  }
  return killed;
}

/**
 * Also check active spirit bomb projectiles for continuous collision with enemies.
 */
export function damageEnemiesWithProjectiles(
  sys: EnemySystem,
  projectiles: { x: number; y: number; radius: number; alive: boolean }[],
): void {
  for (const p of projectiles) {
    if (!p.alive) continue;
    for (const e of sys.enemies) {
      if (!e.alive) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy < p.radius * p.radius) {
        e.alive = false;
        sys.kills++;
      }
    }
  }
}

/**
 * Remove dead enemies far from camera.
 */
export function cleanupEnemies(sys: EnemySystem, scrollY: number, canvasHeight: number): void {
  sys.enemies = sys.enemies.filter(
    e => e.alive && e.y > scrollY - 200 && e.y < scrollY + canvasHeight + 400
  );
}
