import { Player } from './physics/player';
import { TerrainGrid, CELL_SCALE, getCell, setCell, Material } from './terrain/grid';

export const DIG_INTERVAL = 0.12; // seconds between each cell carved (slower than falling)
const DIG_REACH = 6;              // pixels past player edge

/** Carve a player-sized rectangle in the aim direction */
export function carveDigArea(
  player: Player, terrain: TerrainGrid,
  dx: number, dy: number,
) {
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return;
  const ndx = dx / len;
  const ndy = dy / len;
  const px = -ndy;
  const py = ndx;

  const halfLen = player.h / 2 + CELL_SCALE;
  const halfW = player.w / 2;
  const halfH = player.h / 2;
  const edgeDist = Math.abs(ndx) * halfW + Math.abs(ndy) * halfH;
  const depth = edgeDist + DIG_REACH;
  const cx = player.x + ndx * (depth / 2);
  const cy = player.y + ndy * (depth / 2) - CELL_SCALE * 2;

  const extent = halfLen + depth;
  const gxMin = Math.floor((cx - extent) / CELL_SCALE);
  const gxMax = Math.floor((cx + extent) / CELL_SCALE);
  const gyMin = Math.floor((cy - extent) / CELL_SCALE);
  const gyMax = Math.floor((cy + extent) / CELL_SCALE);

  for (let gy = gyMin; gy <= gyMax; gy++) {
    for (let gx = gxMin; gx <= gxMax; gx++) {
      const cellX = gx * CELL_SCALE + CELL_SCALE / 2;
      const cellY = gy * CELL_SCALE + CELL_SCALE / 2;
      const relX = cellX - cx;
      const relY = cellY - cy;
      const projDepth = Math.abs(relX * ndx + relY * ndy);
      const projPerp = Math.abs(relX * px + relY * py);

      if (projDepth <= depth / 2 && projPerp <= halfLen) {
        const mat = getCell(terrain, gx, gy);
        if (mat !== Material.AIR && mat !== Material.WATER && mat !== Material.WALL) {
          setCell(terrain, gx, gy, Material.AIR);
        }
      }
    }
  }
}

/** Get the dig light visual position/size for the aim direction */
export function getDigLightFromAim(
  player: Player, aimDirX: number, aimDirY: number,
): { x: number; y: number; w: number; h: number } {
  const len = Math.sqrt(aimDirX * aimDirX + aimDirY * aimDirY);
  const ndx = len > 0.01 ? aimDirX / len : 0;
  const ndy = len > 0.01 ? aimDirY / len : -1;

  const halfW = player.w / 2;
  const halfH = player.h / 2;
  const edgeDist = Math.abs(ndx) * halfW + Math.abs(ndy) * halfH;
  const depth = edgeDist + DIG_REACH;
  const lx = player.x + ndx * (depth / 2);
  const ly = player.y + ndy * (depth / 2) - CELL_SCALE * 2;

  const perpLen = player.h + CELL_SCALE * 2;
  const px = -ndy;
  const py = ndx;
  const lightW = Math.abs(ndx * depth) + Math.abs(px * perpLen);
  const lightH = Math.abs(ndy * depth) + Math.abs(py * perpLen);

  return { x: lx, y: ly, w: lightW, h: lightH };
}
