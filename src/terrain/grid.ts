import { GRID_W, GRID_H, CELL_SCALE } from '../gameConfig';
export { GRID_W, GRID_H, CELL_SCALE };

export const enum Material {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  RUBBLE = 4,
  WATER = 5,
  WALL = 6,
}

export interface TerrainGrid {
  cells: Uint8Array;
  width: number;
  height: number;
  /** Number of grid rows that have been scrolled off the top of the buffer. */
  worldYOffset: number;
}

/**
 * Create an empty terrain grid. Caller fills it via generateRows().
 */
export function createTerrainGrid(): TerrainGrid {
  const cells = new Uint8Array(GRID_W * GRID_H);
  return { cells, width: GRID_W, height: GRID_H, worldYOffset: 0 };
}

/**
 * Get cell material at world grid coordinates.
 * Returns AIR for out-of-buffer cells.
 */
export function getCell(grid: TerrainGrid, worldGx: number, worldGy: number): Material {
  if (worldGx < 0 || worldGx >= grid.width) return Material.AIR;
  const localGy = worldGy - grid.worldYOffset;
  if (localGy < 0 || localGy >= grid.height) return Material.AIR;
  return grid.cells[localGy * grid.width + worldGx] as Material;
}

/** Solid for collision purposes. Water is NOT solid (player passes through it). */
export function isSolid(grid: TerrainGrid, worldGx: number, worldGy: number): boolean {
  const mat = getCell(grid, worldGx, worldGy);
  return mat !== Material.AIR && mat !== Material.WATER;
}

export function isWater(grid: TerrainGrid, worldGx: number, worldGy: number): boolean {
  return getCell(grid, worldGx, worldGy) === Material.WATER;
}

/**
 * Shift the grid buffer upward by `rows` rows, discarding the top.
 * The vacated bottom rows are filled with AIR (caller generates new terrain into them).
 */
export function shiftGridUp(grid: TerrainGrid, rows: number): void {
  const { cells, width, height } = grid;
  const shift = rows * width;
  cells.copyWithin(0, shift);
  cells.fill(Material.AIR, (height - rows) * width);
  grid.worldYOffset += rows;
}

/**
 * Set a cell at world grid coordinates (if in buffer range).
 */
export function setCell(grid: TerrainGrid, worldGx: number, worldGy: number, mat: Material): void {
  if (worldGx < 0 || worldGx >= grid.width) return;
  const localGy = worldGy - grid.worldYOffset;
  if (localGy < 0 || localGy >= grid.height) return;
  grid.cells[localGy * grid.width + worldGx] = mat;
}

/**
 * Run cellular automata: RUBBLE falls/slides, WATER falls/spreads.
 */
export function stepAutomata(grid: TerrainGrid): void {
  const { cells, width, height } = grid;
  const preferLeft = Math.random() < 0.5;
  const dir1 = preferLeft ? -1 : 1;
  const dir2 = preferLeft ? 1 : -1;

  // Scan bottom→top so falling doesn't cascade multiple rows in one step
  for (let gy = height - 2; gy >= 0; gy--) {
    // Alternate scan direction per row to reduce lateral bias
    const xStart = (gy & 1) ? width - 1 : 0;
    const xEnd = (gy & 1) ? -1 : width;
    const xStep = (gy & 1) ? -1 : 1;

    for (let gx = xStart; gx !== xEnd; gx += xStep) {
      const idx = gy * width + gx;
      const mat = cells[idx];

      if (mat === Material.RUBBLE) {
        const below = (gy + 1) * width + gx;
        // Rubble falls into AIR or WATER
        if (cells[below] === Material.AIR || cells[below] === Material.WATER) {
          cells[below] = Material.RUBBLE;
          cells[idx] = Material.AIR;
          continue;
        }
        // Slide diagonally
        if (trySlideRubble(cells, width, height, gx, gy, dir1)) continue;
        trySlideRubble(cells, width, height, gx, gy, dir2);
      } else if (mat === Material.WATER) {
        const below = (gy + 1) * width + gx;
        // Water falls down into AIR
        if (gy + 1 < height && cells[below] === Material.AIR) {
          cells[below] = Material.WATER;
          cells[idx] = Material.AIR;
          continue;
        }
        // Slide diagonally into AIR
        if (trySlideWater(cells, width, height, gx, gy, dir1)) continue;
        if (trySlideWater(cells, width, height, gx, gy, dir2)) continue;
        // Spread sideways (water seeks its level)
        if (trySpreadWater(cells, width, gx, gy, dir1)) continue;
        trySpreadWater(cells, width, gx, gy, dir2);
      }
    }
  }
}

function trySlideRubble(
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

function trySlideWater(
  cells: Uint8Array, width: number, height: number,
  gx: number, gy: number, dx: number,
): boolean {
  const nx = gx + dx;
  if (nx < 0 || nx >= width || gy + 1 >= height) return false;
  const sideIdx = gy * width + nx;
  const diagIdx = (gy + 1) * width + nx;
  if ((cells[sideIdx] === Material.AIR || cells[sideIdx] === Material.WATER) && cells[diagIdx] === Material.AIR) {
    cells[diagIdx] = Material.WATER;
    cells[gy * width + gx] = Material.AIR;
    return true;
  }
  return false;
}

function trySpreadWater(
  cells: Uint8Array, width: number,
  gx: number, gy: number, dx: number,
): boolean {
  const nx = gx + dx;
  if (nx < 0 || nx >= width) return false;
  const sideIdx = gy * width + nx;
  if (cells[sideIdx] === Material.AIR) {
    cells[sideIdx] = Material.WATER;
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
 * Carve a crater at world pixel coordinates (px, py) with given radius in pixels.
 * Destroys dirt/grass/rubble/water (evaporates water). Stone is immune.
 */
export function carveExplosion(
  grid: TerrainGrid,
  px: number, py: number,
  radiusPx: number,
  maxWorldPy = Infinity,
): CarveResult {
  const cx = Math.floor(px / CELL_SCALE);
  const cy = Math.floor(py / CELL_SCALE);
  const r = Math.ceil(radiusPx / CELL_SCALE);
  const maxGy = maxWorldPy < Infinity ? Math.floor(maxWorldPy / CELL_SCALE) : Infinity;
  let count = 0;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;

      const worldGx = cx + dx;
      const worldGy = cy + dy;
      if (worldGy > maxGy) continue;
      if (worldGx < 0 || worldGx >= grid.width) continue;
      const localGy = worldGy - grid.worldYOffset;
      if (localGy < 0 || localGy >= grid.height) continue;

      const idx = localGy * grid.width + worldGx;
      const mat = grid.cells[idx] as Material;
      if (mat === Material.AIR || mat === Material.WALL) continue;

      grid.cells[idx] = Material.AIR;
      count++;
    }
  }

  return { count, centerGx: cx, centerGy: cy };
}
