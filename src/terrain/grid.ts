export const GRID_W = 480;
export const GRID_H = 540; // ~2 screens tall: buffer above + visible + buffer below
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

export function isSolid(grid: TerrainGrid, worldGx: number, worldGy: number): boolean {
  return getCell(grid, worldGx, worldGy) !== Material.AIR;
}

/**
 * Shift the grid buffer upward by `rows` rows, discarding the top.
 * The vacated bottom rows are filled with AIR (caller generates new terrain into them).
 */
export function shiftGridUp(grid: TerrainGrid, rows: number): void {
  const { cells, width, height } = grid;
  const shift = rows * width;
  // Move data up
  cells.copyWithin(0, shift);
  // Clear the vacated bottom rows
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
 * Run cellular automata: RUBBLE falls and settles.
 */
export function stepAutomata(grid: TerrainGrid): void {
  const { cells, width, height } = grid;
  const preferLeft = Math.random() < 0.5;

  for (let gy = height - 2; gy >= 0; gy--) {
    for (let gx = 0; gx < width; gx++) {
      const idx = gy * width + gx;
      if (cells[idx] !== Material.RUBBLE) continue;

      const below = (gy + 1) * width + gx;

      if (cells[below] === Material.AIR) {
        cells[below] = Material.RUBBLE;
        cells[idx] = Material.AIR;
        continue;
      }

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
 * Carve a crater at world pixel coordinates (px, py) with given radius in pixels.
 * Inner 60% → AIR, outer 40% → RUBBLE.
 */
export function carveExplosion(
  grid: TerrainGrid,
  px: number, py: number,
  radiusPx: number,
): CarveResult {
  const cx = Math.floor(px / CELL_SCALE);
  const cy = Math.floor(py / CELL_SCALE);
  const r = Math.ceil(radiusPx / CELL_SCALE);
  let count = 0;

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > r) continue;

      const worldGx = cx + dx;
      const worldGy = cy + dy;
      if (worldGx < 0 || worldGx >= grid.width) continue;
      const localGy = worldGy - grid.worldYOffset;
      if (localGy < 0 || localGy >= grid.height) continue;

      const idx = localGy * grid.width + worldGx;
      const mat = grid.cells[idx] as Material;
      if (mat === Material.AIR || mat === Material.STONE) continue;

      grid.cells[idx] = Material.AIR;
      count++;
    }
  }

  return { count, centerGx: cx, centerGy: cy };
}
