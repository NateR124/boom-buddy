import { TerrainGrid, GRID_W, Material } from './grid';

/** World grid row where the surface (grass) begins. */
export const SURFACE_ROW = 80;

/**
 * Simple 2D value noise using a hash. Deterministic for a given (x, y).
 */
function hash2(x: number, y: number): number {
  let n = x * 73 + y * 157 + 37;
  n = ((n ^ (n >>> 8)) * 2654435761) >>> 0;
  return (n & 0xffff) / 65536;
}

function smoothNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // Smoothstep
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** Two-octave noise for cave shapes. */
function caveNoise(gx: number, gy: number): number {
  let v = smoothNoise(gx * 0.06, gy * 0.06) * 0.65;
  v += smoothNoise(gx * 0.14, gy * 0.14) * 0.35;
  return v;
}

/**
 * Generate terrain for rows [startWorldGy, startWorldGy + count) into the grid buffer.
 * Rows above SURFACE_ROW are AIR. The surface row is GRASS. Below is procedural underground.
 */
export function generateRows(grid: TerrainGrid, startWorldGy: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const worldGy = startWorldGy + i;
    const localGy = worldGy - grid.worldYOffset;
    if (localGy < 0 || localGy >= grid.height) continue;

    const rowOffset = localGy * GRID_W;

    // Above surface: AIR
    if (worldGy < SURFACE_ROW) {
      for (let gx = 0; gx < GRID_W; gx++) {
        grid.cells[rowOffset + gx] = Material.AIR;
      }
      continue;
    }

    // Surface row: GRASS
    if (worldGy === SURFACE_ROW) {
      for (let gx = 0; gx < GRID_W; gx++) {
        grid.cells[rowOffset + gx] = Material.GRASS;
      }
      continue;
    }

    // Underground generation
    const depth = worldGy - SURFACE_ROW;

    for (let gx = 0; gx < GRID_W; gx++) {
      const n = caveNoise(gx, worldGy);

      // Cave threshold: higher = more caves. Varies with depth.
      // Shallow: some caves. Medium: more caves. Deep: tighter tunnels.
      let caveThreshold: number;
      if (depth < 80) {
        caveThreshold = 0.42; // shallow — moderate caves
      } else if (depth < 250) {
        caveThreshold = 0.45; // medium — more open
      } else {
        caveThreshold = 0.38; // deep — tighter
      }

      // Horizontal shelves every ~40 rows for landing spots
      const shelfPhase = depth % 40;
      const isShelf = shelfPhase >= 0 && shelfPhase <= 1;

      if (n < caveThreshold && !isShelf) {
        grid.cells[rowOffset + gx] = Material.AIR;
      } else {
        grid.cells[rowOffset + gx] = Material.DIRT;

        // Grass cap: if the cell above is AIR and this is dirt, make it grass
        if (worldGy > SURFACE_ROW + 1) {
          const aboveLocalGy = localGy - 1;
          if (aboveLocalGy >= 0 && grid.cells[aboveLocalGy * GRID_W + gx] === Material.AIR) {
            if (grid.cells[rowOffset + gx] === Material.DIRT) {
              grid.cells[rowOffset + gx] = Material.GRASS;
            }
          }
        }
      }
    }
  }
}
