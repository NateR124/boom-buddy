/** Central source of truth for game dimensions and zoom. */

export const CANVAS_W = 960;
export const CANVAS_H = 540;
export const CELL_SCALE = 2;

/** Grid dimensions derived from canvas + zoom */
export const GRID_W = CANVAS_W / CELL_SCALE;   // 480
export const GRID_H = CANVAS_H;                 // 540 cells = ~2 screens of buffer
