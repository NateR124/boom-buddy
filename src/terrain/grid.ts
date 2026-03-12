import { Platform } from '../physics/world';

export const GRID_W = 480;
export const GRID_H = 270;
export const CELL_SCALE = 2; // each grid cell = 2x2 screen pixels

export const enum Material {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  RUBBLE = 4,
}

export interface TerrainGrid {
  cells: Uint8Array;
  width: number;
  height: number;
}

export function createTerrainGrid(platforms: Platform[]): TerrainGrid {
  const cells = new Uint8Array(GRID_W * GRID_H);

  for (const plat of platforms) {
    const gx0 = Math.floor(plat.x / CELL_SCALE);
    const gy0 = Math.floor(plat.y / CELL_SCALE);
    const gx1 = Math.floor((plat.x + plat.w) / CELL_SCALE);
    const gy1 = Math.floor((plat.y + plat.h) / CELL_SCALE);

    for (let gy = gy0; gy < gy1; gy++) {
      for (let gx = gx0; gx < gx1; gx++) {
        if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) continue;
        // Top row of platform = grass, rest = dirt
        cells[gy * GRID_W + gx] = gy === gy0 ? Material.GRASS : Material.DIRT;
      }
    }
  }

  return { cells, width: GRID_W, height: GRID_H };
}

export function getCell(grid: TerrainGrid, gx: number, gy: number): Material {
  if (gx < 0 || gx >= grid.width || gy < 0 || gy >= grid.height) return Material.AIR;
  return grid.cells[gy * grid.width + gx] as Material;
}

export function isSolid(grid: TerrainGrid, gx: number, gy: number): boolean {
  return getCell(grid, gx, gy) !== Material.AIR;
}

/**
 * Run cellular automata: RUBBLE falls and settles.
 * Call multiple times per tick to accelerate settling.
 */
export function stepAutomata(grid: TerrainGrid): void {
  const { cells, width, height } = grid;
  // Randomize slide direction preference each step
  const preferLeft = Math.random() < 0.5;

  // Scan bottom→top so falling doesn't cascade multiple rows in one step
  for (let gy = height - 2; gy >= 0; gy--) {
    for (let gx = 0; gx < width; gx++) {
      const idx = gy * width + gx;
      if (cells[idx] !== Material.RUBBLE) continue;

      const below = (gy + 1) * width + gx;

      // Fall straight down
      if (cells[below] === Material.AIR) {
        cells[below] = Material.RUBBLE;
        cells[idx] = Material.AIR;
        continue;
      }

      // Slide diagonally
      const dir1 = preferLeft ? -1 : 1;
      const dir2 = preferLeft ? 1 : -1;

      if (trySlide(cells, width, height, gx, gy, dir1)) continue;
      trySlide(cells, width, height, gx, gy, dir2);
    }
  }
}

function trySlide(
  cells: Uint8Array, width: number, height: number,
  gx: number, gy: number, dx: number,
): boolean {
  const nx = gx + dx;
  if (nx < 0 || nx >= width || gy + 1 >= height) return false;

  const sideIdx = gy * width + nx;
  const diagIdx = (gy + 1) * width + nx;

  if (cells[sideIdx] === Material.AIR && cells[diagIdx] === Material.AIR) {
    cells[diagIdx] = Material.RUBBLE;
    cells[gy * width + gx] = Material.AIR;
    return true;
  }
  return false;
}

export interface CarveResult {
  count: number;
  centerGx: number;
  centerGy: number;
}

/**
 * Carve a crater at pixel coordinates (px, py) with given radius in pixels.
 * Inner 60% → AIR, outer 40% → RUBBLE.
 * Returns info about the carve for particle emission.
 */
export function carveExplosion(
  grid: TerrainGrid,
  px: number, py: number,
  radiusPx: number,
): CarveResult {
  const cx = Math.floor(px / CELL_SCALE);
  const cy = Math.floor(py / CELL_SCALE);
  const r = Math.ceil(radiusPx / CELL_SCALE);
  const innerR = r * 0.6;
  let count = 0;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;

      const gx = cx + dx;
      const gy = cy + dy;
      if (gx < 0 || gx >= grid.width || gy < 0 || gy >= grid.height) continue;

      const idx = gy * grid.width + gx;
      const mat = grid.cells[idx] as Material;
      if (mat === Material.AIR || mat === Material.STONE) continue;

      grid.cells[idx] = Material.AIR;
      count++;
    }
  }

  return { count, centerGx: cx, centerGy: cy };
}
