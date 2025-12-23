import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  createEmptyGrid, 
  generateHand, 
  GRID_SIZE,
} from './constants';
import { 
  canPlaceBlock, 
  canPlaceAny, 
  placeBlockAndProcess,
  rotateBlockDefinition
} from './utils/gameLogic';
import { BlockDefinition, CellData, Coordinate, HistoryState } from './types';
import { Block } from './components/Block';
import { RotateCcw, HelpCircle, Trophy, Trash2, RotateCw, Volume2, VolumeX, Undo2, RefreshCw, Zap } from 'lucide-react';
import { soundManager } from './utils/SoundManager';
import clsx from 'clsx';

// Hook for accessing latest state in event listeners
function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

const App: React.FC = () => {
  // State
  const [grid, setGrid] = useState<CellData[][]>(createEmptyGrid());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [hand, setHand] = useState<BlockDefinition[]>([]);
  const [turn, setTurn] = useState(1);
  const [combo, setCombo] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [history, setHistory] = useState<HistoryState[]>([]);
  
  const [tutorialOpen, setTutorialOpen] = useState(false); // Default to false, check init logic
  const [isMuted, setIsMuted] = useState(false);

  // Dragging State
  const [dragBlock, setDragBlock] = useState<BlockDefinition | null>(null);
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
  const [ghostPosition, setGhostPosition] = useState<Coordinate | null>(null);

  // Refs for DOM elements to calculate coordinates
  const gridRef = useRef<HTMLDivElement>(null);
  
  // Game Initialization & Persistence
  const startNewGame = useCallback(() => {
    setGrid(createEmptyGrid());
    setScore(0);
    setTurn(1);
    setCombo(0);
    setIsGameOver(false);
    setHand(generateHand(3, 1));
    setHistory([]);
    localStorage.removeItem('leftover_save');
    soundManager.play('rotate'); // Slight feedback on reset
  }, []);

  // Load state on mount
  useEffect(() => {
    // 1. Load High Score
    const savedScore = localStorage.getItem('leftover_highscore');
    if (savedScore) setHighScore(parseInt(savedScore, 10));

    // 2. Load Game State
    const savedState = localStorage.getItem('leftover_save');
    let loaded = false;
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.grid && parsed.hand) {
          setGrid(parsed.grid);
          setScore(parsed.score);
          setHand(parsed.hand);
          setTurn(parsed.turn);
          setIsGameOver(parsed.isGameOver);
          setHistory(parsed.history || []);
          setCombo(parsed.combo || 0);
          loaded = true;
        }
      } catch (e) {
        console.error("Failed to load save", e);
      }
    }

    if (!loaded) {
      startNewGame();
      setTutorialOpen(true); // Show tutorial only on fresh start
    }
  }, [startNewGame]);

  // Save state on change
  useEffect(() => {
    if (grid.some(row => row.some(c => c.status !== 'empty')) || score > 0 || turn > 1) {
      const stateToSave = {
        grid,
        score,
        hand,
        turn,
        isGameOver,
        history,
        combo
      };
      localStorage.setItem('leftover_save', JSON.stringify(stateToSave));
    }
  }, [grid, score, hand, turn, isGameOver, history, combo]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('leftover_highscore', score.toString());
    }
  }, [score, highScore]);

  // Handle Game Over Sound
  useEffect(() => {
    if (isGameOver) {
      soundManager.play('gameOver');
    }
  }, [isGameOver]);

  const toggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  // Undo Logic
  const handleUndo = () => {
    if (history.length === 0) return;
    
    soundManager.play('rotate'); // Reuse a sound for feedback

    const previousState = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    setGrid(previousState.grid);
    setScore(previousState.score);
    setHand(previousState.hand);
    setTurn(previousState.turn);
    setIsGameOver(previousState.isGameOver);
    setCombo(previousState.combo);
    setHistory(newHistory);
  };

  // Handle Rotation
  const handleRotate = (block: BlockDefinition) => {
    soundManager.play('rotate');
    setHand(currentHand => 
      currentHand.map(b => 
        b.id === block.id ? rotateBlockDefinition(b) : b
      )
    );
  };

  // Handle Drag Logic
  const handleDragStart = (block: BlockDefinition, startX: number, startY: number) => {
    setDragBlock(block);
    setDragPosition({ x: startX, y: startY });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    setDragPosition({ x: clientX, y: clientY });

    // Calculate Grid Position
    if (gridRef.current && dragBlock) {
      const rect = gridRef.current.getBoundingClientRect();
      const cellSize = rect.width / GRID_SIZE;
      
      const blockWidth = Math.max(...dragBlock.cells.map(c => c.x)) + 1;
      const blockHeight = Math.max(...dragBlock.cells.map(c => c.y)) + 1;
      
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;

      const mouseGridX = relX / cellSize;
      const mouseGridY = relY / cellSize;

      const gridX = Math.round(mouseGridX - (blockWidth / 2));
      const gridY = Math.round(mouseGridY - (blockHeight / 2));

      if (canPlaceBlock(grid, dragBlock, gridX, gridY)) {
        setGhostPosition({ x: gridX, y: gridY });
      } else {
        setGhostPosition(null);
      }
    }
  };

  const handleDragEnd = () => {
    if (dragBlock && ghostPosition) {
      // SAVE HISTORY BEFORE MODIFYING STATE
      const currentStateSnapshot: HistoryState = {
        grid, // State updates are immutable so this ref is safe to store as "old state"
        score,
        hand,
        turn,
        isGameOver,
        combo
      };
      // Limit history to 20 steps
      setHistory(prev => [...prev.slice(-19), currentStateSnapshot]);

      // SUCCESSFUL PLACEMENT
      const { newGrid, linesCleared, junkCreated, points, newCombo } = placeBlockAndProcess(
        grid, 
        dragBlock, 
        ghostPosition.x, 
        ghostPosition.y,
        combo
      );
      
      // Sound Logic
      if (linesCleared > 0) {
        if (junkCreated > 0) {
          soundManager.play('junk');
        } else {
          soundManager.play('perfect');
        }
      } else {
        soundManager.play('place');
      }

      setGrid(newGrid);
      setScore(s => s + points);
      setCombo(newCombo);
      
      // Remove placed block from hand
      const newHand = hand.filter(b => b.id !== dragBlock.id);
      
      // Logic for next turn
      if (newHand.length === 0) {
        // Refill hand
        const nextHand = generateHand(3, turn);
        setHand(nextHand);
        setTurn(t => t + 1);
        
        if (!canPlaceAny(newGrid, nextHand)) {
          setIsGameOver(true);
        }
      } else {
        setHand(newHand);
        // Check if remaining blocks can be placed
        if (!canPlaceAny(newGrid, newHand)) {
          setIsGameOver(true);
        }
      }
    }

    setDragBlock(null);
    setDragPosition(null);
    setGhostPosition(null);
  };

  // Styles helpers
  const getCellClasses = (cell: CellData, x: number, y: number) => {
    const isGhost = ghostPosition && dragBlock?.cells.some(c => (ghostPosition.x + c.x) === x && (ghostPosition.y + c.y) === y);
    
    let classes = "w-full h-full rounded transition-all duration-200 border-2 ";
    
    if (cell.status === 'filled') {
      classes += "border-black/10 shadow-sm ";
    } else if (cell.status === 'junk') {
      classes += "bg-junk border-junk/50 shadow-inner ";
    } else {
      classes += "bg-white border-transparent ";
    }

    if (isGhost) {
      classes += "opacity-60 scale-95 ring-2 ring-black/10 "; 
    }

    return classes;
  };

  const getCellStyle = (cell: CellData, x: number, y: number) => {
    const isGhost = ghostPosition && dragBlock?.cells.some(c => (ghostPosition.x + c.x) === x && (ghostPosition.y + c.y) === y);
    
    if (isGhost && dragBlock) {
      return { backgroundColor: dragBlock.color };
    }
    
    if (cell.status === 'filled') {
      return { backgroundColor: cell.color };
    }
    
    return {};
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center safe-area-padding overflow-hidden font-sans">
      
      {/* Header */}
      <header className="w-full max-w-md p-4 flex justify-between items-center bg-white shadow-sm z-10">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-800">LEFTOVER</h1>
          <p className="text-xs text-gray-500 font-medium">DON'T WASTE SPACE</p>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={startNewGame} className="text-gray-400 hover:text-indigo-600 transition-colors" title="New Game">
             <RefreshCw size={20} />
           </button>
           <button onClick={toggleMute} className="text-gray-400 hover:text-gray-600 transition-colors">
             {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
           </button>
           <div className="text-right">
             <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">Score</div>
             <div className="text-3xl font-black text-indigo-600 leading-none">{score}</div>
           </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-md flex flex-col items-center justify-center p-4 gap-6 relative">
        
        {/* Stats Bar */}
        <div className="w-full flex justify-between items-center px-2 text-sm text-gray-500 font-medium h-6">
          <div className="flex items-center gap-1">
             <Trophy size={16} /> <span>Best: {highScore}</span>
          </div>
          
          {/* Combo Indicator */}
          <div className={clsx(
              "flex items-center gap-1 font-black transition-all duration-300",
              combo > 1 ? "opacity-100 text-orange-500 scale-100" : "opacity-0 scale-90"
          )}>
              <Zap size={16} fill="currentColor" className="animate-pulse" />
              <span>COMBO x{combo}</span>
          </div>

          <div className="flex items-center gap-1">
             <Trash2 size={16} /> <span>Junk: {grid.flat().filter(c => c.status === 'junk').length}</span>
          </div>
        </div>

        {/* Grid Container */}
        <div 
          className="relative bg-grid rounded-xl p-3 shadow-inner border border-gray-200"
          ref={gridRef}
          style={{ width: 'min(90vw, 22rem)', height: 'min(90vw, 22rem)' }} // Square aspect ratio
        >
          {/* Render Grid */}
          <div className="w-full h-full grid grid-cols-6 grid-rows-6 gap-1.5">
            {grid.map((row, y) => (
              row.map((cell, x) => (
                <div 
                  key={cell.id} 
                  className={getCellClasses(cell, x, y)}
                  style={getCellStyle(cell, x, y)}
                >
                  {cell.status === 'junk' && (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                      <div className="w-1/2 h-1/2 bg-black rounded-full" />
                    </div>
                  )}
                </div>
              ))
            ))}
          </div>
        </div>

        {/* Hand Area */}
        <div className="relative w-full min-h-[8rem] flex justify-around items-center bg-white rounded-xl shadow-sm border border-gray-100 p-4">
           {/* Controls Hints */}
           <button 
             onClick={handleUndo}
             disabled={history.length === 0}
             className="absolute top-2 left-2 flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors z-20"
           >
             <Undo2 size={12} /> Undo
           </button>
           
           <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-widest pointer-events-none opacity-50">
             <RotateCw size={10} /> Rotate
           </div>

           {hand.map(block => (
             <Block 
               key={block.id} 
               block={block} 
               onDragStart={handleDragStart}
               onDragMove={handleDragMove}
               onDragEnd={handleDragEnd}
               onRotate={handleRotate}
               disabled={isGameOver}
             />
           ))}
           {hand.length === 0 && !isGameOver && (
             <div className="text-gray-300 text-sm font-medium animate-pulse">Refilling...</div>
           )}
        </div>

      </main>

      {/* Floating Dragged Block */}
      {dragBlock && dragPosition && (
        <div 
          className="fixed pointer-events-none z-50 opacity-80"
          style={{ 
            left: dragPosition.x, 
            top: dragPosition.y,
            transform: 'translate(-50%, -50%) scale(1.1)' 
          }}
        >
          {/* Visual replica of the block */}
          <div className="relative">
             {dragBlock.cells.map((cell, i) => (
               <div
                  key={i}
                  className="absolute rounded-md shadow-lg"
                  style={{
                    left: `${cell.x * 2.5}rem`,
                    top: `${cell.y * 2.5}rem`,
                    width: `2.3rem`,
                    height: `2.3rem`,
                    backgroundColor: dragBlock.color,
                  }}
                />
             ))}
          </div>
        </div>
      )}

      {/* Modals */}
      
      {/* Game Over Modal */}
      {isGameOver && (
        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-fade-in">
            <h2 className="text-4xl font-black text-gray-900 mb-2">FULL!</h2>
            <p className="text-gray-600 mb-6">The junk piled up. No more moves.</p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6 flex justify-between items-center">
              <span className="text-gray-500 font-bold">SCORE</span>
              <span className="text-3xl font-black text-indigo-600">{score}</span>
            </div>

            <div className="flex gap-3">
                {history.length > 0 && (
                    <button 
                    onClick={handleUndo}
                    className="flex-1 bg-white text-gray-900 border-2 border-gray-200 font-bold py-4 rounded-xl shadow-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                    <Undo2 size={20} /> UNDO
                    </button>
                )}
                
                <button 
                onClick={startNewGame}
                className="flex-[2] bg-black text-white font-bold py-4 rounded-xl shadow-lg hover:scale-105 transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                <RotateCcw size={20} /> TRY AGAIN
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Modal */}
      {tutorialOpen && (
        <div className="absolute inset-0 z-50 bg-indigo-900/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-fade-in">
            <div className="flex justify-between items-start mb-4">
               <h2 className="text-2xl font-black text-gray-900">HOW TO PLAY</h2>
               <button onClick={() => setTutorialOpen(false)} className="text-gray-400 hover:text-gray-600">
                 ✕
               </button>
            </div>
            
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">1</div>
                <p>Drag blocks to the grid. Fill rows or columns to clear them.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">
                  <RotateCw size={14} />
                </div>
                <p>Tap a block to rotate it.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded bg-red-100 text-red-700 flex items-center justify-center font-bold flex-shrink-0">!</div>
                <p className="font-semibold">Here is the twist:</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 text-orange-900">
                If you clear a line that only cuts through <strong>part</strong> of a block, the leftover part turns into <strong>JUNK</strong>.
              </div>
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded bg-gray-600 flex items-center justify-center flex-shrink-0">
                  <div className="w-4 h-4 bg-black/30 rounded-full" />
                </div>
                <p><strong>Junk</strong> cannot be moved or cleared. It stays forever.</p>
              </div>
            </div>

            <button 
              onClick={() => setTutorialOpen(false)}
              className="mt-6 w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
      
      {/* Help Button */}
      <button 
        onClick={() => setTutorialOpen(true)}
        className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
      >
        <HelpCircle size={24} />
      </button>

    </div>
  );
};

export default App;