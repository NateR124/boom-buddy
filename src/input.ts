export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;  // true only on the frame jump was first pressed
  jumpReleased: boolean; // true only on the frame jump was released
  charge: boolean;
  chargeReleased: boolean;
  up: boolean;
  pausePressed: boolean;
}

const keys = new Set<string>();
const justPressed = new Set<string>();
const justReleased = new Set<string>();

export function initInput() {
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

  // Clear all held keys when window loses focus to prevent stuck movement
  window.addEventListener('blur', () => {
    keys.clear();
  });
}

export function getInput(): InputState {
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  const up = keys.has('KeyW') || keys.has('ArrowUp');

  const jumpKeys = ['KeyW', 'ArrowUp'];
  const jump = jumpKeys.some(k => keys.has(k));
  const jumpPressed = jumpKeys.some(k => justPressed.has(k));
  const jumpReleased = jumpKeys.some(k => justReleased.has(k));

  const charge = keys.has('Space');
  const chargeReleased = justReleased.has('Space');
  const pausePressed = justPressed.has('Escape');

  return { left, right, jump, jumpPressed, jumpReleased, charge, chargeReleased, up, pausePressed };
}

export function clearFrameInput() {
  justPressed.clear();
  justReleased.clear();
}
