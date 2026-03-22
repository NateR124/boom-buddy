export interface EnemyConfig {
  spawnInterval: number;    // world pixels of descent between spawn checks
  baseSpawnChance: number;  // chance per check at surface level
  depthChanceBonus: number; // additional chance per 1000px depth
  minPerSpawn: number;      // minimum enemies per successful spawn
  maxPerSpawn: number;      // maximum enemies per successful spawn
  batSpeed: number;         // pixels per second
  batBaseHp: number;         // base hit points at surface
  batHpPerDepth: number;     // extra HP per depth level
}

export function createDefaultEnemyConfig(): EnemyConfig {
  return {
    spawnInterval: 200,
    baseSpawnChance: 0.3,
    depthChanceBonus: 0.05,
    minPerSpawn: 1,
    maxPerSpawn: 3,
    batSpeed: 40,
    batBaseHp: 5,
    batHpPerDepth: 0.5,
  };
}
