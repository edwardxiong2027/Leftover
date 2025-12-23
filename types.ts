export type CellStatus = 'empty' | 'filled' | 'junk';

export interface Coordinate {
  x: number;
  y: number;
}

export interface CellData {
  id: string; // Unique ID for React keys
  status: CellStatus;
  color?: string; // Color for filled cells
  blockId?: string; // ID of the block this cell belongs to (for leftover logic)
}

export interface BlockDefinition {
  id: string;
  cells: Coordinate[];
  color: string;
  basePoints?: number;
}

export interface GameState {
  grid: CellData[][];
  score: number;
  highScore: number;
  gameOver: boolean;
  hand: BlockDefinition[];
  turnCount: number;
  junkCount: number;
}

export interface HistoryState {
  grid: CellData[][];
  score: number;
  hand: BlockDefinition[];
  turn: number;
  isGameOver: boolean;
  combo: number;
}