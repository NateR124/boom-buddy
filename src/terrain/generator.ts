import { TerrainGrid, GRID_W, Material } from './grid';
import { CANVAS_H, CELL_SCALE } from '../gameConfig';
import { CavePlan, isInsidePath, expandPlan } from './cavePlan';

/** World grid row where the surface (grass) begins. */
export const SURFACE_ROW = 80;

/** Solid barrier to force first bomb use */
const BARRIER_START = SURFACE_ROW + 8;
const BARRIER_THICKNESS = 6;

/** Boss room at depth 300 */
export const WIN_DEPTH = 300;
const BOSS_ROOM_HEIGHT_GY = Math.floor(CANVAS_H * 4 / CELL_SCALE); // 4 screens tall (3 falling + 1 bat room)
export const BOSS_ROOM_START_GY = SURFACE_ROW + Math.floor(WIN_DEPTH * CANVAS_H / CELL_SCALE);
const BOSS_ROOM_END_GY = BOSS_ROOM_START_GY + BOSS_ROOM_HEIGHT_GY;
const BOSS_FLOOR_THICKNESS = 3;

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
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function waterNoise(gx: number, gy: number): number {
  return smoothNoise(gx * 0.04 + 500, gy * 0.04 + 300);
}

export function generateRows(grid: TerrainGrid, startWorldGy: number, count: number, plan: CavePlan): void {
  const wt = plan.config.wallThickness;
  expandPlan(plan, startWorldGy + count + 200);

  for (let i = 0; i < count; i++) {
    const worldGy = startWorldGy + i;
    const localGy = worldGy - grid.worldYOffset;
    if (localGy < 0 || localGy >= grid.height) continue;

    const rowOffset = localGy * GRID_W;

    // Boss room: empty above floor, solid WALL at and below floor
    if (worldGy >= BOSS_ROOM_START_GY) {
      for (let gx = 0; gx < GRID_W; gx++) {
        if (worldGy >= BOSS_ROOM_END_GY) {
          grid.cells[rowOffset + gx] = Material.WALL; // solid floor, all the way down
        } else if (gx < wt || gx >= GRID_W - wt) {
          grid.cells[rowOffset + gx] = Material.WALL;
        } else {
          grid.cells[rowOffset + gx] = Material.AIR;
        }
      }
      continue;
    }

    // Above surface: AIR (with walls on edges)
    if (worldGy <= SURFACE_ROW) {
      for (let gx = 0; gx < GRID_W; gx++) {
        if (gx < wt || gx >= GRID_W - wt) {
          grid.cells[rowOffset + gx] = Material.WALL;
        } else {
          grid.cells[rowOffset + gx] = Material.AIR;
        }
      }
      continue;
    }

    // Underground generation
    const depth = worldGy - SURFACE_ROW;

    for (let gx = 0; gx < GRID_W; gx++) {
      // Indestructible walls on left and right edges
      if (gx < wt || gx >= GRID_W - wt) {
        grid.cells[rowOffset + gx] = Material.WALL;
        continue;
      }

      // Solid barrier near surface — forces player to bomb through
      if (worldGy >= BARRIER_START && worldGy < BARRIER_START + BARRIER_THICKNESS) {
        grid.cells[rowOffset + gx] = Material.DIRT;
        continue;
      }

      const inPath = isInsidePath(plan, gx, worldGy);

      if (inPath) {
        // Water in deep cave pools
        if (depth > 15 && waterNoise(gx, worldGy) > plan.config.waterThreshold) {
          const belowInPath = isInsidePath(plan, gx, worldGy + 1);
          if (!belowInPath) {
            grid.cells[rowOffset + gx] = Material.WATER;
          } else {
            grid.cells[rowOffset + gx] = Material.AIR;
          }
        } else {
          grid.cells[rowOffset + gx] = Material.AIR;
        }
      } else {
        // All solid terrain is destructible dirt
        grid.cells[rowOffset + gx] = Material.DIRT;

        // Grass cap: if the cell above is AIR, make this grass
        if (worldGy > SURFACE_ROW + 1) {
          const aboveLocalGy = localGy - 1;
          if (aboveLocalGy >= 0 && grid.cells[aboveLocalGy * GRID_W + gx] === Material.AIR) {
            grid.cells[rowOffset + gx] = Material.GRASS;
          }
        }
      }
    }
  }
}
