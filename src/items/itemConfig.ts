export interface ItemConfig {
  dropRate: number; // average items per 100 rows of cave
  commonChance: number;
  uncommonChance: number;
  rareChance: number;
  legendaryChance: number;
  purpleBallDensityRate: number; // density gain per second per stack
  windBallModifier: number; // terrain destroy modifier per stack
}

export function createDefaultItemConfig(): ItemConfig {
  return {
    dropRate: 3,
    commonChance: 0.4,
    uncommonChance: 0.3,
    rareChance: 0.2,
    legendaryChance: 0.1,
    purpleBallDensityRate: 1.0,
    windBallModifier: 0.3,
  };
}
