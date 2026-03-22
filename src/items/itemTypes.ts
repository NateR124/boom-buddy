export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export type ItemId = 'purple_ball' | 'wind_ball' | 'white_ball' | 'gold_ball' | 'smiley_face';

export interface ItemDef {
  id: ItemId;
  name: string;
  rarity: Rarity;
  color: string; // render color
  symbol: string; // single character for display
}

export const ITEM_DEFS: ItemDef[] = [
  { id: 'purple_ball', name: 'Purple Ball', rarity: 'common', color: '#a040ff', symbol: '\u25CF' },
  { id: 'wind_ball', name: 'Glow Ball', rarity: 'uncommon', color: '#ff8c00', symbol: '\u25CE' },
  { id: 'white_ball', name: 'Wind Ball', rarity: 'uncommon', color: '#ffffff', symbol: '\u25CB' },
  { id: 'gold_ball', name: 'Gold Ball', rarity: 'rare', color: '#ffd700', symbol: '\u25C9' },
  { id: 'smiley_face', name: 'Smiley Face', rarity: 'legendary', color: '#ffdd00', symbol: '\u263A' },
];

export function getItemDef(id: ItemId): ItemDef {
  return ITEM_DEFS.find(d => d.id === id)!;
}
