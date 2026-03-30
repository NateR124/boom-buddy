import { EnemyConfig } from './enemyConfig';

export interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  fromLeft: boolean;
  hp: number;
  maxHp: number;
}

/** Floating damage number */
export interface DamageNumber {
  x: number;
  y: number;
  amount: number;
  age: number; // seconds since created
  color: string; // CSS color for the number
}

const DAMAGE_NUMBER_LIFETIME = 0.8; // seconds before fade-out complete
const DAMAGE_NUMBER_RISE = 40; // pixels to float upward

export interface EnemySystem {
  enemies: Enemy[];
  lastSpawnDepth: number;
  kills: number;
  damageNumbers: DamageNumber[];
}

export function createEnemySystem(): EnemySystem {
  return {
    enemies: [],
    lastSpawnDepth: 0,
    kills: 0,
    damageNumbers: [],
  };
}

function getEnemyHp(scrollY: number, config: EnemyConfig): number {
  const depth = Math.max(0, scrollY / 540); // depth in screen-heights
  return Math.round(config.batBaseHp + depth * config.batHpPerDepth);
}

/**
 * Spawn new bats based on player descent.
 */
// Safety cap: max spawn checks per call. Prevents lag spikes or edge cases
// from dumping hundreds of bats in a single frame. Normal gameplay advances
// a few pixels per frame, so this never triggers during regular play.
const MAX_SPAWN_CHECKS = 40;

export function spawnEnemies(
  sys: EnemySystem,
  scrollY: number,
  canvasWidth: number,
  canvasHeight: number,
  config: EnemyConfig,
): void {
  let checks = 0;
  while (scrollY - sys.lastSpawnDepth >= config.spawnInterval && checks < MAX_SPAWN_CHECKS) {
    sys.lastSpawnDepth += config.spawnInterval;
    checks++;

    const depth = sys.lastSpawnDepth;
    const chance = Math.min(config.baseSpawnChance + (depth / 1000) * config.depthChanceBonus, 0.95);

    if (Math.random() > chance) continue;

    const depthLevel = Math.max(0, scrollY / 540);
    const maxSpawn = config.maxPerSpawn + Math.floor(depthLevel * config.spawnBonusPerDepth);
    const count = config.minPerSpawn + Math.floor(Math.random() * (maxSpawn - config.minPerSpawn + 1));
    const hp = getEnemyHp(scrollY, config);

    for (let i = 0; i < count; i++) {
      const fromLeft = Math.random() < 0.5;
      const x = fromLeft ? -20 : canvasWidth + 20;
      const y = scrollY + canvasHeight * 0.2 + Math.random() * canvasHeight * 0.6;

      sys.enemies.push({ x, y, vx: 0, vy: 0, alive: true, fromLeft, hp, maxHp: hp });
    }
  }
  // If we hit the cap, fast-forward to avoid repeating the burst next frame
  if (checks >= MAX_SPAWN_CHECKS && scrollY - sys.lastSpawnDepth >= config.spawnInterval) {
    sys.lastSpawnDepth = scrollY;
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

    // Apply knockback velocity
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    // Decay knockback
    e.vx *= Math.max(0, 1 - 3 * dt);
    e.vy *= Math.max(0, 1 - 3 * dt);

    // Move toward player (reduced if being knocked back)
    const knockSpeed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
    const chaseMult = Math.max(0, 1 - knockSpeed / 200);
    const depthSpd = Math.max(0, e.y / 540);
    const speed = config.batSpeed + depthSpd * config.batSpeedPerDepth;
    e.x += (dx / dist) * speed * chaseMult * dt;
    e.y += (dy / dist) * speed * chaseMult * dt;
  }

  // Age damage numbers and remove expired (swap-remove to avoid O(n) splice)
  let dnLen = sys.damageNumbers.length;
  for (let i = dnLen - 1; i >= 0; i--) {
    sys.damageNumbers[i].age += dt;
    if (sys.damageNumbers[i].age >= DAMAGE_NUMBER_LIFETIME) {
      sys.damageNumbers[i] = sys.damageNumbers[--dnLen];
    }
  }
  sys.damageNumbers.length = dnLen;
}

function applyDamage(sys: EnemySystem, e: Enemy, damage: number, color = '#ff4444'): boolean {
  e.hp -= damage;
  // Spawn damage number
  sys.damageNumbers.push({
    x: e.x + (Math.random() - 0.5) * 10,
    y: e.y - 8,
    amount: damage,
    age: 0,
    color,
  });
  if (e.hp <= 0) {
    e.alive = false;
    sys.kills++;
    return true;
  }
  return false;
}

/**
 * Check if any enemy overlaps the player hitbox. Returns damage count.
 */
export function checkEnemyPlayerCollision(
  sys: EnemySystem,
  px: number, py: number,
  pw: number, ph: number,
): { hits: number; killedPositions: { x: number; y: number }[] } {
  let hits = 0;
  const killedPositions: { x: number; y: number }[] = [];
  const halfW = pw / 2;
  const halfH = ph / 2;

  for (const e of sys.enemies) {
    if (!e.alive) continue;
    if (
      e.x > px - halfW - 16 &&
      e.x < px + halfW + 16 &&
      e.y > py - halfH - 16 &&
      e.y < py + halfH + 16
    ) {
      killedPositions.push({ x: e.x, y: e.y });
      e.alive = false;
      sys.kills++;
      hits++;
    }
  }
  return { hits, killedPositions };
}

/**
 * Deal damage to enemies within a radius. Returns { hit, killed }.
 */
export function damageEnemiesInRadius(
  sys: EnemySystem,
  cx: number, cy: number,
  radius: number,
  damage = 1,
  color = '#ff4444',
): { hit: number; killed: number; killedPositions: { x: number; y: number }[] } {
  let hit = 0;
  let killed = 0;
  const killedPositions: { x: number; y: number }[] = [];
  for (const e of sys.enemies) {
    if (!e.alive) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    if (dx * dx + dy * dy < radius * radius) {
      hit++;
      if (applyDamage(sys, e, damage, color)) {
        killed++;
        killedPositions.push({ x: e.x, y: e.y });
      }
    }
  }
  return { hit, killed, killedPositions };
}

/**
 * Knock back enemies in a radius. Force scales with windStacks.
 */
export function knockbackEnemiesInRadius(
  sys: EnemySystem,
  cx: number, cy: number,
  radius: number,
  force: number,
): void {
  for (const e of sys.enemies) {
    if (!e.alive) continue;
    const dx = e.x - cx;
    const dy = e.y - cy;
    const distSq = dx * dx + dy * dy;
    if (distSq < radius * radius && distSq > 1) {
      const dist = Math.sqrt(distSq);
      const falloff = 1 - dist / radius;
      e.vx += (dx / dist) * force * falloff;
      e.vy += (dy / dist) * force * falloff;
    }
  }
}

/**
 * Also check active spirit bomb projectiles for continuous collision with enemies.
 */
export function damageEnemiesWithProjectiles(
  sys: EnemySystem,
  projectiles: { x: number; y: number; radius: number; alive: boolean; power: number }[],
): void {
  for (const p of projectiles) {
    if (!p.alive) continue;
    const damage = Math.max(1, Math.round(p.power * 3));
    for (const e of sys.enemies) {
      if (!e.alive) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      if (dx * dx + dy * dy < p.radius * p.radius) {
        applyDamage(sys, e, damage);
      }
    }
  }
}

/**
 * Remove dead enemies far from camera.
 */
export function cleanupEnemies(sys: EnemySystem, scrollY: number, canvasHeight: number): void {
  // In-place compaction avoids allocating a new array every frame
  const minY = scrollY - 200;
  const maxY = scrollY + canvasHeight + 400;
  let len = sys.enemies.length;
  for (let i = len - 1; i >= 0; i--) {
    const e = sys.enemies[i];
    if (!e.alive || e.y <= minY || e.y >= maxY) {
      sys.enemies[i] = sys.enemies[--len];
    }
  }
  sys.enemies.length = len;
}

/** Damage number render entry — reused pool to avoid per-frame allocation */
export interface DamageNumberRender {
  x: number; y: number; amount: number; alpha: number; color: string;
}

const dnRenderPool: DamageNumberRender[] = [];

/** Get damage number rendering data (reuses pooled array) */
export function getDamageNumberRenderData(sys: EnemySystem): DamageNumberRender[] {
  const count = sys.damageNumbers.length;
  // Grow pool if needed
  while (dnRenderPool.length < count) {
    dnRenderPool.push({ x: 0, y: 0, amount: 0, alpha: 0, color: '' });
  }
  for (let i = 0; i < count; i++) {
    const dn = sys.damageNumbers[i];
    const entry = dnRenderPool[i];
    entry.x = dn.x;
    entry.y = dn.y - (dn.age / DAMAGE_NUMBER_LIFETIME) * DAMAGE_NUMBER_RISE;
    entry.amount = dn.amount;
    entry.alpha = 1 - dn.age / DAMAGE_NUMBER_LIFETIME;
    entry.color = dn.color;
  }
  // Return a view of the pool (caller iterates only up to count)
  dnRenderPool.length = count;
  return dnRenderPool;
}
