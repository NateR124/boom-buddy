export interface HealthConfig {
  maxHp: number;
  regenPerSecond: number;
  bombDamageThreshold: number; // spirit bomb radius above which charging hurts
  bombDamagePerSecond: number;
}

export function createDefaultHealthConfig(): HealthConfig {
  return {
    maxHp: 100,
    regenPerSecond: 0.1,
    bombDamageThreshold: 2000,
    bombDamagePerSecond: 7.5,
  };
}
