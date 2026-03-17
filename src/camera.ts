/**
 * Camera system: screen shake + one-way downward scroll.
 */

export interface Camera {
  /** World-space Y pixel at the top of the screen. Only increases. */
  scrollY: number;
  shakeX: number;
  shakeY: number;
  shakeIntensity: number;
  shakeDuration: number;
  shakeTimer: number;
}

export function createCamera(): Camera {
  return { scrollY: 0, shakeX: 0, shakeY: 0, shakeIntensity: 0, shakeDuration: 0, shakeTimer: 0 };
}

/**
 * Smoothly scroll the camera down to follow the player.
 * One-way: scrollY never decreases.
 */
export function updateCameraScroll(cam: Camera, playerY: number, screenH: number, dt: number): void {
  // Keep player in the upper 40% of the screen
  const target = playerY - screenH * 0.35;
  if (target > cam.scrollY) {
    cam.scrollY += (target - cam.scrollY) * Math.min(1, 5 * dt);
  }
}

export function addShake(cam: Camera, intensity: number, duration: number) {
  cam.shakeIntensity = Math.min(cam.shakeIntensity + intensity, 20);
  cam.shakeDuration = Math.max(cam.shakeDuration, duration);
  cam.shakeTimer = cam.shakeDuration;
}

export function updateShake(cam: Camera, dt: number) {
  if (cam.shakeTimer <= 0) {
    cam.shakeX = 0;
    cam.shakeY = 0;
    cam.shakeIntensity = 0;
    return;
  }

  cam.shakeTimer -= dt;
  const t = cam.shakeTimer / cam.shakeDuration;
  const amplitude = cam.shakeIntensity * t * t;

  cam.shakeX = (Math.random() * 2 - 1) * amplitude;
  cam.shakeY = (Math.random() * 2 - 1) * amplitude;
}
