export interface ItemConfig {
  dropRate: number; // average items per 100 rows of cave
  commonChance: number;
  uncommonChance: number;
  rareChance: number;
  legendaryChance: number;
  purpleBallDensityRate: number; // density gain per second per stack
  windBallModifier: number; // terrain destroy modifier per stack
  goldBallRadius: number; // base magnetism radius per stack
  goldBallSpeed: number; // base magnetism pull speed per stack
}

export function createDefaultItemConfig(): ItemConfig {
  return {
    dropRate: 0.375,
    commonChance: 0.6,
    uncommonChance: 0.35,
    rareChance: 0.05,
    legendaryChance: 0,
    purpleBallDensityRate: 0.05,
    windBallModifier: 0.1,
    goldBallRadius: 30,
    goldBallSpeed: 40,
  };
}
