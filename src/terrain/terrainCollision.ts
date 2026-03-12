import { Player } from '../physics/player';
import { Projectile } from '../physics/projectile';
import { TerrainGrid, CELL_SCALE, isSolid } from './grid';

/**
 * Resolve player collision against the terrain grid.
 * Strategy: move player, then scan grid cells overlapping the player AABB.
 * Resolve Y axis first (ground/ceiling), then X (walls).
 */
export function resolvePlayerTerrainCollision(player: Player, grid: TerrainGrid): void {
  const halfW = player.w / 2;
  const halfH = player.h / 2;

  // --- Y-axis resolution (ground + ceiling) ---
  resolvePlayerY(player, grid, halfW, halfH);

  // --- X-axis resolution (walls) ---
  resolvePlayerX(player, grid, halfW, halfH);
}

function resolvePlayerY(player: Player, grid: TerrainGrid, halfW: number, halfH: number): void {
  // Player AABB edges in grid coords (inset 1px to avoid corner catching)
  const leftG = Math.floor((player.x - halfW + 1) / CELL_SCALE);
  const rightG = Math.floor((player.x + halfW - 1) / CELL_SCALE);

  if (player.vy >= 0) {
    // Falling or stationary — scan from center down to feet to find topmost ground
    const centerG = Math.floor(player.y / CELL_SCALE);
    const footY = player.y + halfH;
    const footG = Math.floor(footY / CELL_SCALE) + 1; // +1 for tolerance

    let groundY = Infinity;
    for (let gx = leftG; gx <= rightG; gx++) {
      for (let gy = centerG; gy <= footG; gy++) {
        if (isSolid(grid, gx, gy)) {
          const cellTop = gy * CELL_SCALE;
          if (cellTop < groundY) {
            groundY = cellTop;
          }
          break; // found topmost solid in this column, stop scanning down
        }
      }
    }

    if (groundY < Infinity) {
      player.y = groundY - halfH;
      player.vy = 0;
      player.grounded = true;
    }
  } else {
    // Rising — scan from center up to head to find lowest ceiling
    const centerG = Math.floor(player.y / CELL_SCALE);
    const headY = player.y - halfH;
    const headG = Math.floor(headY / CELL_SCALE) - 1; // -1 for tolerance

    let ceilingY = -Infinity;
    for (let gx = leftG; gx <= rightG; gx++) {
      for (let gy = centerG; gy >= headG; gy--) {
        if (isSolid(grid, gx, gy)) {
          const cellBot = (gy + 1) * CELL_SCALE;
          if (cellBot > ceilingY) {
            ceilingY = cellBot;
          }
          break; // found lowest solid in this column, stop scanning up
        }
      }
    }

    if (ceilingY > -Infinity) {
      player.y = ceilingY + halfH;
      player.vy = 0;
    }
  }
}

function resolvePlayerX(player: Player, grid: TerrainGrid, halfW: number, halfH: number): void {
  // Use updated Y position for X checks (avoid corner sticking)
  const topG = Math.floor((player.y - halfH + 2) / CELL_SCALE);
  const botG = Math.floor((player.y + halfH - 2) / CELL_SCALE);

  // Only check walls in the direction of movement (strict inequality prevents drift at rest)
  if (player.vx < 0) {
    const leftEdge = player.x - halfW;
    const leftG = Math.floor(leftEdge / CELL_SCALE);

    for (let gy = topG; gy <= botG; gy++) {
      if (isSolid(grid, leftG, gy)) {
        const wallRight = (leftG + 1) * CELL_SCALE;
        if (wallRight > leftEdge) {
          player.x = wallRight + halfW;
          player.vx = 0;
          break;
        }
      }
    }
  } else if (player.vx > 0) {
    const rightEdge = player.x + halfW;
    const rightG = Math.floor(rightEdge / CELL_SCALE);

    for (let gy = topG; gy <= botG; gy++) {
      if (isSolid(grid, rightG, gy)) {
        const wallLeft = rightG * CELL_SCALE;
        if (wallLeft < rightEdge) {
          player.x = wallLeft - halfW;
          player.vx = 0;
          break;
        }
      }
    }
  }

}

/**
 * Check if a projectile hits any solid terrain cell.
 * For spirit bombs: center-point check.
 * For charge shots: circle scan.
 */
export function projectileHitsTerrain(proj: Projectile, grid: TerrainGrid): boolean {
  if (proj.type === 'spirit_bomb') {
    // Center point
    const gx = Math.floor(proj.x / CELL_SCALE);
    const gy = Math.floor(proj.y / CELL_SCALE);
    return isSolid(grid, gx, gy);
  }

  // Circle scan for charge shots
  const r = Math.ceil(proj.radius / CELL_SCALE);
  const cx = Math.floor(proj.x / CELL_SCALE);
  const cy = Math.floor(proj.y / CELL_SCALE);
  const rSq = (proj.radius / CELL_SCALE) * (proj.radius / CELL_SCALE);

  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > rSq) continue;
      if (isSolid(grid, cx + dx, cy + dy)) return true;
    }
  }
  return false;
}
