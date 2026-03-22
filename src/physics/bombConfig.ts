export interface BombConfig {
  chargeSpeed: number;
  chargeAcceleration: number;
  fallSpeed: number;
  fallSpeedSizeDebuff: number;
}

export function createDefaultBombConfig(): BombConfig {
  return {
    chargeSpeed: 2000,
    chargeAcceleration: 500,
    fallSpeed: 500,
    fallSpeedSizeDebuff: 1.5,
  };
}
