/**
 * Screen shake system.
 * Call `addShake` on impact, then `updateShake` each physics tick.
 * The offset is applied as a camera translation to all renderers.
 */

export interface Camera {
  shakeX: number;
  shakeY: number;
  shakeIntensity: number;
  shakeDuration: number;
  shakeTimer: number;
}

export function createCamera(): Camera {
  return { shakeX: 0, shakeY: 0, shakeIntensity: 0, shakeDuration: 0, shakeTimer: 0 };
}

export function addShake(cam: Camera, intensity: number, duration: number) {
  // Stack with existing shake, capped
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
  const t = cam.shakeTimer / cam.shakeDuration; // 1 → 0
  const amplitude = cam.shakeIntensity * t * t; // quadratic decay

  cam.shakeX = (Math.random() * 2 - 1) * amplitude;
  cam.shakeY = (Math.random() * 2 - 1) * amplitude;
}
