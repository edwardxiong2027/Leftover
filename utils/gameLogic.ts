import { CellData, BlockDefinition, Coordinate, CellStatus } from '../types';
import { GRID_SIZE, JUNK_COLOR } from '../constants';

export const rotateBlockDefinition = (block: BlockDefinition): BlockDefinition => {
  // Rotate 90 degrees clockwise: (x, y) -> (-y, x)
  const rotatedCells = block.cells.map(cell => ({
    x: -cell.y,
    y: cell.x
  }));

  // Normalize coordinates to start at (0,0)
  // We find the minimum x and y values and subtract them from all coordinates
  const minX = Math.min(...rotatedCells.map(c => c.x));
  const minY = Math.min(...rotatedCells.map(c => c.y));

  const normalizedCells = rotatedCells.map(cell => ({
    x: cell.x - minX,
    y: cell.y - minY
  }));

  // We sort cells to ensure consistent rendering/processing order, though not strictly required
  normalizedCells.sort((a, b) => (a.y - b.y) || (a.x - b.x));

  return {
    ...block,
    cells: normalizedCells
  };
};

export const canPlaceBlock = (
  grid: CellData[][],
  block: BlockDefinition,
  targetX: number,
  targetY: number
): boolean => {
  for (const cell of block.cells) {
    const x = targetX + cell.x;
    const y = targetY + cell.y;

    // Out of bounds
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
      return false;
    }

    // Collision (Filled or Junk)
    if (grid[y][x].status !== 'empty') {
      return false;
    }
  }
  return true;
};

// Returns true if ANY block in the hand can be placed SOMEWHERE
export const canPlaceAny = (grid: CellData[][], hand: BlockDefinition[]): boolean => {
  if (hand.length === 0) return true; // Empty hand is "safe" until refilled, but usually we check after refill

  for (const block of hand) {
    // Check original orientation
    if (canPlaceInAnyOrientation(grid, block)) return true;
  }
  return false;
};

// Helper to check if a block can be placed in ANY valid rotation
const canPlaceInAnyOrientation = (grid: CellData[][], block: BlockDefinition): boolean => {
  let currentBlock = block;
  // Check all 4 rotations
  for (let i = 0; i < 4; i++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (canPlaceBlock(grid, currentBlock, x, y)) {
          return true;
        }
      }
    }
    currentBlock = rotateBlockDefinition(currentBlock);
  }
  return false;
}

interface PlacementResult {
  newGrid: CellData[][];
  linesCleared: number;
  junkCreated: number;
  points: number;
  newCombo: number;
}

export const placeBlockAndProcess = (
  currentGrid: CellData[][],
  block: BlockDefinition,
  targetX: number,
  targetY: number,
  currentCombo: number = 0
): PlacementResult => {
  // 1. Create a deep copy of the grid
  let newGrid = currentGrid.map(row => row.map(cell => ({ ...cell })));

  // 2. Place the block
  // We attach the blockId to these cells to track them for the Leftover mechanic
  for (const cell of block.cells) {
    const x = targetX + cell.x;
    const y = targetY + cell.y;
    newGrid[y][x] = {
      ...newGrid[y][x],
      status: 'filled',
      color: block.color,
      blockId: block.id
    };
  }

  // 3. Check for full lines (Rows & Cols)
  // A line is full if EVERY cell is non-empty (either filled or junk)
  const fullRows: number[] = [];
  const fullCols: number[] = [];

  // Check Rows
  for (let y = 0; y < GRID_SIZE; y++) {
    const isFull = newGrid[y].every(cell => cell.status !== 'empty');
    if (isFull) fullRows.push(y);
  }

  // Check Cols
  for (let x = 0; x < GRID_SIZE; x++) {
    const isFull = newGrid.every(row => row[x].status !== 'empty');
    if (isFull) fullCols.push(x);
  }

  let linesCleared = fullRows.length + fullCols.length;
  let junkCreated = 0;
  let points = 0;
  let newCombo = 0;

  if (linesCleared > 0) {
    // 4. Identify Affected Blocks
    // We need to find ALL unique blockIds that exist in the cleared lines.
    const affectedBlockIds = new Set<string>();

    // Scan full rows
    fullRows.forEach(y => {
      newGrid[y].forEach(cell => {
        if (cell.blockId) affectedBlockIds.add(cell.blockId);
      });
    });

    // Scan full cols
    fullCols.forEach(x => {
      newGrid.forEach(row => {
        if (row[x].blockId) affectedBlockIds.add(row[x].blockId);
      });
    });

    // 5. Apply Leftover Logic
    // For each affected block, check every cell it owns on the entire grid.
    // If a cell is part of a cleared line -> It is removed.
    // If a cell is NOT part of a cleared line -> It becomes JUNK.

    // First, let's identify which specific cells (x,y) are being cleared
    const clearedCells = new Set<string>(); // "x,y"
    fullRows.forEach(y => {
      for (let x = 0; x < GRID_SIZE; x++) clearedCells.add(`${x},${y}`);
    });
    fullCols.forEach(x => {
      for (let y = 0; y < GRID_SIZE; y++) clearedCells.add(`${x},${y}`);
    });

    // Now iterate entire grid to update statuses
    // We do this in a way that respects the "Atomic" nature of the turn
    
    // We need a map of cells to update to avoid modifying while reading
    const updates: {x: number, y: number, status: CellStatus, color?: string}[] = [];

    // Let's iterate over the whole grid to find cells belonging to affected blocks
    for(let y=0; y<GRID_SIZE; y++) {
      for(let x=0; x<GRID_SIZE; x++) {
        const cell = newGrid[y][x];
        const key = `${x},${y}`;
        const isComputableLine = clearedCells.has(key);

        if (cell.status === 'junk') {
          // Junk stays junk. No change.
          continue;
        }

        if (cell.status === 'filled') {
          if (isComputableLine) {
            // This cell is in the firing line. It gets removed!
            updates.push({ x, y, status: 'empty' });
          } else if (cell.blockId && affectedBlockIds.has(cell.blockId)) {
            // This cell is NOT in the firing line, BUT it belongs to a block that was hit.
            // It becomes JUNK.
            updates.push({ x, y, status: 'junk', color: JUNK_COLOR });
            junkCreated++;
          }
        }
      }
    }

    // Apply updates
    updates.forEach(u => {
      newGrid[u.y][u.x] = {
        ...newGrid[u.y][u.x],
        status: u.status,
        color: u.color,
        blockId: undefined // Remove block identity after processing
      };
    });
    
    // Scoring logic
    
    // Determine Combo
    // Combo increases if we cleared lines AND created NO junk
    if (junkCreated === 0) {
      newCombo = currentCombo + 1;
    } else {
      newCombo = 0;
    }

    // Base points for clearing
    points += linesCleared * 100;
    
    // Bonus for keeping it clean (no junk created this turn)
    if (junkCreated === 0) {
      points += 50 * linesCleared;
    }

    // Combo Bonus
    // If we have a streak (combo > 1), we add bonus points
    if (newCombo > 1) {
      points += (newCombo - 1) * 100; // E.g., Combo 2 = +100, Combo 3 = +200
    }

  } else {
    // No lines cleared. Reset combo.
    newCombo = 0;
    // Points for placing blocks? Maybe small amount.
    points += block.cells.length * 10;
  }

  return { newGrid, linesCleared, junkCreated, points, newCombo };
};