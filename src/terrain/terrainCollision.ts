import { Player } from '../physics/player';
import { Projectile } from '../physics/projectile';
import { TerrainGrid, CELL_SCALE, isSolid } from './grid';

// Collision insets — shrink the player's collision box so it's forgiving.
// Visual size is w=20, h=40, but collision checks use smaller bounds.
const INSET_X = 3;  // pixels shaved off each side horizontally
const INSET_Y_TOP = 4;  // pixels shaved off the head
const INSET_Y_BOT = 1;  // pixels shaved off the feet (keep ground feel tight)
const CORNER_INSET_Y = 5; // extra vertical inset for Y-axis checks (avoids corner snagging)
const CORNER_INSET_X = 6; // extra horizontal inset for X-axis checks

/**
 * Resolve player collision against the terrain grid.
 * Strategy: move player, then scan grid cells overlapping the player AABB.
 * Resolve Y axis first (ground/ceiling), then X (walls).
 */
export function resolvePlayerTerrainCollision(player: Player, grid: TerrainGrid): void {
  const halfW = player.w / 2 - INSET_X;
  const halfH = player.h / 2;

  // --- Y-axis resolution (ground + ceiling) ---
  resolvePlayerY(player, grid, halfW, halfH);

  // --- X-axis resolution (walls) ---
  resolvePlayerX(player, grid, halfW, halfH);
}

function resolvePlayerY(player: Player, grid: TerrainGrid, halfW: number, halfH: number): void {
  // Extra horizontal inset for Y checks — lets player squeeze past corners
  const leftG = Math.floor((player.x - halfW + CORNER_INSET_Y) / CELL_SCALE);
  const rightG = Math.floor((player.x + halfW - CORNER_INSET_Y) / CELL_SCALE);

  if (player.vy >= 0) {
    const centerG = Math.floor(player.y / CELL_SCALE);
    const footY = player.y + halfH - INSET_Y_BOT;
    const footG = Math.floor(footY / CELL_SCALE) + 1;

    let groundY = Infinity;
    for (let gx = leftG; gx <= rightG; gx++) {
      for (let gy = centerG; gy <= footG; gy++) {
        if (isSolid(grid, gx, gy)) {
          const cellTop = gy * CELL_SCALE;
          if (cellTop < groundY) {
            groundY = cellTop;
          }
          break;
        }
      }
    }

    if (groundY < Infinity) {
      player.y = groundY - halfH + INSET_Y_BOT;
      player.vy = 0;
      player.grounded = true;
    }
  } else {
    const centerG = Math.floor(player.y / CELL_SCALE);
    const headY = player.y - halfH + INSET_Y_TOP;
    const headG = Math.floor(headY / CELL_SCALE) - 1;

    let ceilingY = -Infinity;
    for (let gx = leftG; gx <= rightG; gx++) {
      for (let gy = centerG; gy >= headG; gy--) {
        if (isSolid(grid, gx, gy)) {
          const cellBot = (gy + 1) * CELL_SCALE;
          if (cellBot > ceilingY) {
            ceilingY = cellBot;
          }
          break;
        }
      }
    }

    if (ceilingY > -Infinity) {
      player.y = ceilingY + halfH - INSET_Y_TOP;
      player.vy = 0;
    }
  }
}

function resolvePlayerX(player: Player, grid: TerrainGrid, halfW: number, halfH: number): void {
  // Extra vertical inset for X checks — lets player slide past ledges
  const topG = Math.floor((player.y - halfH + CORNER_INSET_X) / CELL_SCALE);
  const botG = Math.floor((player.y + halfH - CORNER_INSET_X) / CELL_SCALE);

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
 */
export function projectileHitsTerrain(proj: Projectile, grid: TerrainGrid): boolean {
  if (proj.type === 'spirit_bomb') {
    const gx = Math.floor(proj.x / CELL_SCALE);
    const gy = Math.floor(proj.y / CELL_SCALE);
    return isSolid(grid, gx, gy);
  }

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
