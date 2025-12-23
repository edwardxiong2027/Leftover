import { BlockDefinition, Coordinate } from './types';

export const GRID_SIZE = 6;
export const MAX_BLOCK_SIZE = 3;

// Pastel palette for player blocks
export const BLOCK_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ec4899', // Pink
];

export const JUNK_COLOR = '#475569'; // Slate 600

export const SHAPES: { cells: Coordinate[], probability: number }[] = [
  // 1. Single Dot
  { cells: [{ x: 0, y: 0 }], probability: 1.0 },
  
  // 2. Dominoes
  { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }], probability: 0.8 }, // Horizontal 2
  { cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }], probability: 0.8 }, // Vertical 2
  { cells: [{ x: 0, y: 0 }, { x: 1, y: 1 }], probability: 0.4 }, // Diagonal 2 (Hard!)
  
  // 3. Trominoes (Size 3)
  { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }], probability: 0.6 }, // Horizontal 3
  { cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }], probability: 0.6 }, // Vertical 3
  { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }], probability: 0.6 }, // L-shape
  { cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], probability: 0.6 }, // Reverse L
  { cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], probability: 0.6 }, // L down
  { cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }], probability: 0.6 }, // L right
];

export const generateHand = (count: number, difficulty: number): BlockDefinition[] => {
  const hand: BlockDefinition[] = [];
  
  for (let i = 0; i < count; i++) {
    // Basic difficulty scaling: slightly prefer complex shapes as difficulty increases
    // For now, we just pick random shapes
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const color = BLOCK_COLORS[Math.floor(Math.random() * BLOCK_COLORS.length)];
    
    hand.push({
      id: Math.random().toString(36).substr(2, 9),
      cells: shape.cells,
      color,
    });
  }
  return hand;
};

export const createEmptyGrid = (): import('./types').CellData[][] => {
  return Array(GRID_SIZE).fill(null).map((_, y) => 
    Array(GRID_SIZE).fill(null).map((_, x) => ({
      id: `cell-${x}-${y}`,
      status: 'empty'
    }))
  );
};
