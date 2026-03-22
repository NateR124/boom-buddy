import { ItemConfig } from './itemConfig';
import { ItemId, Rarity } from './itemTypes';
import { CavePlan, isInsidePath } from '../terrain/cavePlan';
import { createRNG, nextFloat, RNG } from '../terrain/cavePlan';
import { GRID_W, CELL_SCALE } from '../terrain/grid';

export interface WorldItem {
  id: ItemId;
  x: number; // world pixel coords
  y: number;
  alive: boolean;
}

export interface ItemSpawner {
  items: WorldItem[];
  /** Last world grid row we checked for spawns. */
  lastSpawnedRow: number;
}

export function createItemSpawner(): ItemSpawner {
  return {
    items: [],
    lastSpawnedRow: 80, // SURFACE_ROW
  };
}

/**
 * Generate item spawns for newly revealed rows.
 * Call when terrain is generated for new rows.
 */
export function spawnItemsForRows(
  spawner: ItemSpawner,
  fromRow: number,
  toRow: number,
  plan: CavePlan,
  config: ItemConfig,
  seed: number,
): void {
  const startRow = Math.max(fromRow, spawner.lastSpawnedRow);
  if (startRow >= toRow) return;

  const rng = createRNG(seed + startRow * 3571);

  // dropRate items per 100 rows → probability per row
  const probPerRow = config.dropRate / 100;

  for (let gy = startRow; gy < toRow; gy++) {
    if (nextFloat(rng) > probPerRow) continue;

    // Find a valid X within a cave path at this row
    const x = findPathX(rng, plan, gy);
    if (x < 0) continue;

    const rarity = rollRarity(rng, config);
    const id = rarityToItem(rarity, rng);

    spawner.items.push({
      id,
      x: x * CELL_SCALE + CELL_SCALE / 2,
      y: gy * CELL_SCALE + CELL_SCALE / 2,
      alive: true,
    });
  }

  spawner.lastSpawnedRow = toRow;
}

function findPathX(rng: RNG, plan: CavePlan, gy: number): number {
  // Try random X positions within the grid, looking for one inside a path
  for (let attempt = 0; attempt < 10; attempt++) {
    const gx = 10 + Math.floor(nextFloat(rng) * (GRID_W - 20));
    if (isInsidePath(plan, gx, gy)) {
      return gx;
    }
  }
  return -1;
}

function rollRarity(rng: RNG, config: ItemConfig): Rarity {
  const roll = nextFloat(rng);
  if (roll < config.commonChance) return 'common';
  if (roll < config.commonChance + config.uncommonChance) return 'uncommon';
  if (roll < config.commonChance + config.uncommonChance + config.rareChance) return 'rare';
  return 'legendary';
}

function rarityToItem(rarity: Rarity, rng: RNG): ItemId {
  switch (rarity) {
    case 'common': return 'purple_ball';
    case 'uncommon': return nextFloat(rng) < 0.5 ? 'wind_ball' : 'white_ball';
    case 'rare': return 'gold_ball';
    case 'legendary': return nextFloat(rng) < 0.15 ? 'extra_life' : 'smiley_face';
  }
}

/**
 * Try to spawn a drop at a world position (e.g. from a killed bat).
 * Uses batDropChance from config.
 */
export function trySpawnDrop(
  spawner: ItemSpawner,
  x: number, y: number,
  config: ItemConfig,
): void {
  if (Math.random() > config.batDropChance) return;
  const rng = createRNG(Math.floor(x * 7919 + y * 104729));
  const rarity = rollRarity(rng, config);
  const id = rarityToItem(rarity, rng);
  spawner.items.push({ id, x, y, alive: true });
}

/**
 * Check if player overlaps any alive items, collect them.
 * Returns array of collected item IDs.
 */
export function collectItems(
  spawner: ItemSpawner,
  px: number, py: number,
  pw: number, ph: number,
): ItemId[] {
  const collected: ItemId[] = [];
  const halfW = pw / 2;
  const halfH = ph / 2;
  const pickupRadius = 12; // generous pickup radius

  for (const item of spawner.items) {
    if (!item.alive) continue;
    // Simple AABB vs point with pickup radius
    if (
      item.x > px - halfW - pickupRadius &&
      item.x < px + halfW + pickupRadius &&
      item.y > py - halfH - pickupRadius &&
      item.y < py + halfH + pickupRadius
    ) {
      item.alive = false;
      collected.push(item.id);
    }
  }

  return collected;
}

/** Remove dead items that are far above the camera to save memory. */
export function cleanupItems(spawner: ItemSpawner, cameraScrollY: number): void {
  spawner.items = spawner.items.filter(
    item => item.alive || item.y > cameraScrollY - 200
  );
}
