export interface ItemConfig {
  dropRate: number; // average items per 100 rows of cave
  commonChance: number;
  uncommonChance: number;
  rareChance: number;
  legendaryChance: number;
  purpleBallMaxChargeBonus: number; // extra max charge seconds per purple ball stack
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
    purpleBallMaxChargeBonus: 0.1, // each purple ball adds 0.1s to max charge (~30 balls to double)
    windBallModifier: 0.05,
    goldBallRadius: 30,
    goldBallSpeed: 40,
  };
}
