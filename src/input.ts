export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;  // true only on the frame jump was first pressed
  jumpReleased: boolean; // true only on the frame jump was released
  up: boolean;
  down: boolean;
  pausePressed: boolean;
  clickPressed: boolean;  // true only on the frame mouse was clicked
  mouseHeld: boolean;     // true while mouse button is held
  mouseReleased: boolean; // true only on the frame mouse was released
  mouseX: number;         // mouse position in canvas pixels
  mouseY: number;
}

const keys = new Set<string>();
const justPressed = new Set<string>();
const justReleased = new Set<string>();

let mouseDown = false;
let mouseClicked = false;  // one-frame flag
let mouseReleased = false; // one-frame flag
let mouseX = 0;
let mouseY = 0;
let canvasRef: HTMLCanvasElement | null = null;

export function initInput(canvas?: HTMLCanvasElement) {
  canvasRef = canvas ?? null;

  window.addEventListener('keydown', (e) => {
    if (!keys.has(e.code)) {
      justPressed.add(e.code);
    }
    keys.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    justReleased.add(e.code);
  });

  window.addEventListener('mousemove', (e) => {
    updateMousePos(e);
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouseDown = true;
      mouseClicked = true;
      updateMousePos(e);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      mouseDown = false;
      mouseReleased = true;
    }
  });

  // Clear all held keys when window loses focus to prevent stuck movement
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
}

function updateMousePos(e: MouseEvent) {
  if (canvasRef) {
    const rect = canvasRef.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvasRef.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvasRef.height / rect.height);
  } else {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
}

export function getInput(): InputState {
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  const up = keys.has('KeyW') || keys.has('ArrowUp');
  const down = keys.has('KeyS') || keys.has('ArrowDown');

  const jumpKeys = ['Space'];
  const jump = jumpKeys.some(k => keys.has(k));
  const jumpPressed = jumpKeys.some(k => justPressed.has(k));
  const jumpReleased = jumpKeys.some(k => justReleased.has(k));

  const pausePressed = justPressed.has('Escape');
  const clickPressed = mouseClicked;
  const held = mouseDown;
  const released = mouseReleased;

  return { left, right, jump, jumpPressed, jumpReleased, up, down, pausePressed, clickPressed, mouseHeld: held, mouseReleased: released, mouseX, mouseY };
}

export function clearFrameInput() {
  justPressed.clear();
  justReleased.clear();
  mouseClicked = false;
  mouseReleased = false;
}
