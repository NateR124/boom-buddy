export interface BombConfig {
  chargeSpeed: number;
  chargeAcceleration: number;
  fallSpeed: number;
  fallSpeedSizeDebuff: number;
}

export function createDefaultBombConfig(): BombConfig {
  return {
    chargeSpeed: 3000,
    chargeAcceleration: 800,
    fallSpeed: 500,
    fallSpeedSizeDebuff: 1.5,
  };
}
