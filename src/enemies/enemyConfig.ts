export interface EnemyConfig {
  spawnInterval: number;    // world pixels of descent between spawn checks
  baseSpawnChance: number;  // chance per check at surface level
  depthChanceBonus: number; // additional chance per 1000px depth
  minPerSpawn: number;      // minimum enemies per successful spawn
  maxPerSpawn: number;      // maximum enemies per successful spawn
  batSpeed: number;         // base pixels per second
  batSpeedPerDepth: number;  // extra speed per depth level
  batBaseHp: number;         // base hit points at surface
  batHpPerDepth: number;     // extra HP per depth level
  spawnBonusPerDepth: number; // extra max spawn count per depth level
}

export function createDefaultEnemyConfig(): EnemyConfig {
  return {
    spawnInterval: 200,
    baseSpawnChance: 0.3,
    depthChanceBonus: 0.05,
    minPerSpawn: 1,
    maxPerSpawn: 3,
    batSpeed: 40,
    batSpeedPerDepth: 1,
    batBaseHp: 5,
    batHpPerDepth: 0.5,
    spawnBonusPerDepth: 0.1,
  };
}
