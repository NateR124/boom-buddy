import { CANVAS_W, CANVAS_H, CELL_SCALE } from './gameConfig';
import { BOSS_ROOM_START_GY, WIN_DEPTH } from './terrain/generator';

export type WinPhase = 'playing' | 'wait' | 'text' | 'boom' | 'white';

export interface WinState {
  phase: WinPhase;
  timer: number;
  triggered: boolean;
}

export function createWinState(): WinState {
  return { phase: 'playing', timer: 0, triggered: false };
}

/** The world-pixel Y of the boss room center */
export function getBossRoomCenterY(): number {
  const roomStartPx = BOSS_ROOM_START_GY * CELL_SCALE;
  const roomH = CANVAS_H * 4;
  return roomStartPx + roomH / 2;
}

/** The world-pixel Y of the boss room floor */
export function getBossFloorY(): number {
  const roomEndGy = BOSS_ROOM_START_GY + Math.floor(CANVAS_H * 4 / CELL_SCALE);
  return roomEndGy * CELL_SCALE;
}

/** Check if player has reached the boss room depth */
export function checkWinTrigger(state: WinState, depth: number): void {
  if (state.triggered || state.phase !== 'playing') return;
  if (depth >= WIN_DEPTH) {
    state.phase = 'wait';
    state.timer = 0;
    state.triggered = true;
  }
}

const WAIT_DURATION = 5;
const TEXT_DURATION = 5;
const BOOM_DURATION = 3;
const WHITE_DURATION = 2;

/** Update the win sequence. Returns true when the game should reset. */
export function updateWinSequence(state: WinState, dt: number): boolean {
  if (state.phase === 'playing') return false;

  state.timer += dt;

  switch (state.phase) {
    case 'wait':
      if (state.timer >= WAIT_DURATION) {
        state.phase = 'text';
        state.timer = 0;
      }
      break;
    case 'text':
      if (state.timer >= TEXT_DURATION) {
        state.phase = 'boom';
        state.timer = 0;
      }
      break;
    case 'boom':
      if (state.timer >= BOOM_DURATION) {
        state.phase = 'white';
        state.timer = 0;
      }
      break;
    case 'white':
      if (state.timer >= WHITE_DURATION) {
        return true; // reset
      }
      break;
  }
  return false;
}

/** Get the spirit bomb radius charging in the statue's mouth during 'boom' phase */
export function getBoomRadius(state: WinState): number {
  if (state.phase !== 'boom') return 0;
  const t = state.timer / BOOM_DURATION;
  // Starts small, grows exponentially
  return 5 + t * t * 200;
}

/** Get the white overlay opacity */
export function getWhiteOverlay(state: WinState): number {
  if (state.phase === 'boom') {
    // Flash at the end of boom
    const t = state.timer / BOOM_DURATION;
    if (t > 0.9) return (t - 0.9) / 0.1;
    return 0;
  }
  if (state.phase === 'white') {
    return 1;
  }
  return 0;
}

// ===== Win sequence HTML overlays =====

export interface WinOverlay {
  update(state: WinState): void;
  destroy(): void;
}

export function createWinOverlay(): WinOverlay {
  const style = document.createElement('style');
  style.textContent = `
    #win-text {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 60;
    }
    #win-text span {
      font-family: monospace;
      font-size: 64px;
      font-weight: bold;
      color: #ffd700;
      text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.4);
      opacity: 0;
      transition: none;
    }
    #win-white {
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      background: white;
      pointer-events: none;
      z-index: 70;
      opacity: 0;
    }
  `;
  document.head.appendChild(style);

  const textEl = document.createElement('div');
  textEl.id = 'win-text';
  const textSpan = document.createElement('span');
  textSpan.textContent = 'YOU WIN!';
  textEl.appendChild(textSpan);

  const whiteEl = document.createElement('div');
  whiteEl.id = 'win-white';

  const wrapper = document.getElementById('game-wrapper');
  if (wrapper) {
    wrapper.appendChild(textEl);
    wrapper.appendChild(whiteEl);
  }

  return {
    update(state: WinState) {
      // Text fade in during 'text' phase
      if (state.phase === 'text') {
        const t = Math.min(state.timer / 4, 1); // fade over 4 of 5 seconds
        textSpan.style.opacity = String(t);
      } else if (state.phase === 'boom' || state.phase === 'white') {
        textSpan.style.opacity = '1';
      } else {
        textSpan.style.opacity = '0';
      }

      // White overlay
      whiteEl.style.opacity = String(getWhiteOverlay(state));
    },
    destroy() {
      textEl.remove();
      whiteEl.remove();
      style.remove();
    },
  };
}

// ===== Boss statue rendering data =====

/** Draw the golden bat statue. Call from projectile renderer. */
export function drawBossStatue(
  verts: number[],
  cameraX: number, cameraY: number,
  time: number,
): void {
  const cx = CANVAS_W / 2 + cameraX;
  const floorY = getBossFloorY();
  const cy = (floorY - 80) + cameraY; // statue sits above the floor

  // Giant body
  drawStatueCircle(verts, cx, cy, 40, 16, [0.75, 0.6, 0.15, 0.9]);

  // Wings — huge, static
  const wingW = 120;
  const wc: [number, number, number, number] = [0.65, 0.5, 0.1, 0.8];
  // Left wing
  verts.push(cx - 20, cy - 10, wc[0], wc[1], wc[2], wc[3]);
  verts.push(cx - 20 - wingW, cy - 50, wc[0], wc[1], wc[2], wc[3]);
  verts.push(cx - 20, cy + 20, wc[0], wc[1], wc[2], wc[3]);
  // Right wing
  verts.push(cx + 20, cy - 10, wc[0], wc[1], wc[2], wc[3]);
  verts.push(cx + 20 + wingW, cy - 50, wc[0], wc[1], wc[2], wc[3]);
  verts.push(cx + 20, cy + 20, wc[0], wc[1], wc[2], wc[3]);

  // Ears
  const earC: [number, number, number, number] = [0.7, 0.55, 0.12, 0.85];
  verts.push(cx - 15, cy - 35, earC[0], earC[1], earC[2], earC[3]);
  verts.push(cx - 25, cy - 65, earC[0], earC[1], earC[2], earC[3]);
  verts.push(cx - 5, cy - 35, earC[0], earC[1], earC[2], earC[3]);
  verts.push(cx + 15, cy - 35, earC[0], earC[1], earC[2], earC[3]);
  verts.push(cx + 25, cy - 65, earC[0], earC[1], earC[2], earC[3]);
  verts.push(cx + 5, cy - 35, earC[0], earC[1], earC[2], earC[3]);

  // Glowing eyes
  const eyePulse = 0.7 + 0.3 * Math.sin(time * 2);
  drawStatueCircle(verts, cx - 14, cy - 10, 6, 8, [1.0, 0.85, 0.2, eyePulse]);
  drawStatueCircle(verts, cx + 14, cy - 10, 6, 8, [1.0, 0.85, 0.2, eyePulse]);
  // Eye glow halos
  drawStatueCircle(verts, cx - 14, cy - 10, 12, 10, [1.0, 0.9, 0.3, eyePulse * 0.2]);
  drawStatueCircle(verts, cx + 14, cy - 10, 12, 10, [1.0, 0.9, 0.3, eyePulse * 0.2]);

  // Mouth (where the spirit bomb charges)
  drawStatueCircle(verts, cx, cy + 15, 8, 8, [0.3, 0.2, 0.05, 0.9]);
}

function drawStatueCircle(
  verts: number[], cx: number, cy: number, r: number, segs: number,
  color: [number, number, number, number],
) {
  const [cr, cg, cb, ca] = color;
  for (let i = 0; i < segs; i++) {
    const a1 = (i / segs) * Math.PI * 2;
    const a2 = ((i + 1) / segs) * Math.PI * 2;
    verts.push(cx, cy, cr, cg, cb, ca);
    verts.push(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, cr, cg, cb, ca);
    verts.push(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r, cr, cg, cb, ca);
  }
}

/** Get the world position of the statue's mouth (for spirit bomb) */
export function getStatueMouthPos(): { x: number; y: number } {
  const floorY = getBossFloorY();
  return { x: CANVAS_W / 2, y: floorY - 80 + 15 };
}
