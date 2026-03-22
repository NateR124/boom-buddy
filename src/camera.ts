/**
 * Camera system: screen shake + one-way downward scroll.
 */

export interface Camera {
  /** World-space Y pixel at the top of the screen. */
  scrollY: number;
  /** Furthest down the camera has ever scrolled (for ceiling calc). */
  maxScrollY: number;
  shakeX: number;
  shakeY: number;
  shakeIntensity: number;
  shakeDuration: number;
  shakeTimer: number;
}

export function createCamera(): Camera {
  return { scrollY: 0, maxScrollY: 0, shakeX: 0, shakeY: 0, shakeIntensity: 0, shakeDuration: 0, shakeTimer: 0 };
}

/**
 * Smoothly scroll the camera to follow the player in both directions.
 * Tracks maxScrollY for ceiling calculation.
 */
export function updateCameraScroll(cam: Camera, playerY: number, screenH: number, dt: number): void {
  const target = playerY - screenH * 0.35;
  cam.scrollY += (target - cam.scrollY) * Math.min(1, 5 * dt);
  if (cam.scrollY > cam.maxScrollY) {
    cam.maxScrollY = cam.scrollY;
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
