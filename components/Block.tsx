import React, { useRef, useState, useEffect } from 'react';
import { BlockDefinition, Coordinate } from '../types';
import { MAX_BLOCK_SIZE } from '../constants';
import clsx from 'clsx';

interface BlockProps {
  block: BlockDefinition;
  onDragStart: (block: BlockDefinition, startX: number, startY: number) => void;
  onDragMove: (deltaX: number, deltaY: number) => void;
  onDragEnd: () => void;
  onRotate?: (block: BlockDefinition) => void;
  disabled?: boolean;
}

const CELL_SIZE_REM = 2.5; // Roughly 40px
const DRAG_THRESHOLD = 5; // Pixels to move before drag starts

export const Block: React.FC<BlockProps> = ({ block, onDragStart, onDragMove, onDragEnd, onRotate, disabled }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Use a ref to access the latest callbacks without restarting the event listeners
  const callbacksRef = useRef({ onDragMove, onDragEnd, onRotate, onDragStart });
  
  // Update callbacks on every render
  useEffect(() => {
    callbacksRef.current = { onDragMove, onDragEnd, onRotate, onDragStart };
  });

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const startX = clientX;
    const startY = clientY;
    let hasMoved = false;

    // We do NOT set isDragging(true) yet. We wait to see if user moves.
    // If they move beyond threshold, we start dragging.
    // If they release before threshold, we trigger rotate.

    const moveHandler = (ev: MouseEvent | TouchEvent) => {
      const currX = 'touches' in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
      const currY = 'touches' in ev ? ev.touches[0].clientY : (ev as MouseEvent).clientY;
      
      const deltaX = currX - startX;
      const deltaY = currY - startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Check if we should start dragging
      if (!hasMoved && distance > DRAG_THRESHOLD) {
        hasMoved = true;
        setIsDragging(true);
        // We retroactively start the drag from the initial point
        callbacksRef.current.onDragStart(block, startX, startY);
      }

      if (hasMoved) {
        // Prevent scrolling on touch devices while dragging
        if (ev.cancelable) {
          ev.preventDefault();
        }
        callbacksRef.current.onDragMove(currX, currY);
      }
    };

    const endHandler = () => {
      // Remove listeners first
      window.removeEventListener('mousemove', moveHandler);
      window.removeEventListener('mouseup', endHandler);
      window.removeEventListener('touchmove', moveHandler);
      window.removeEventListener('touchend', endHandler);

      if (hasMoved) {
        setIsDragging(false);
        callbacksRef.current.onDragEnd();
      } else {
        // It was a tap!
        if (callbacksRef.current.onRotate) {
          callbacksRef.current.onRotate(block);
        }
      }
    };

    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', endHandler);
    window.addEventListener('touchmove', moveHandler, { passive: false });
    window.addEventListener('touchend', endHandler);
  };

  const width = Math.max(...block.cells.map(c => c.x)) + 1;
  const height = Math.max(...block.cells.map(c => c.y)) + 1;

  return (
    <div
      ref={ref}
      className={clsx(
        "relative touch-none transition-transform duration-100 flex-shrink-0 cursor-pointer active:cursor-grabbing",
        isDragging ? "opacity-0" : "opacity-100",
        disabled && "opacity-50 grayscale cursor-not-allowed"
      )}
      style={{
        width: `${width * CELL_SIZE_REM}rem`,
        height: `${height * CELL_SIZE_REM}rem`,
      }}
      onMouseDown={handleStart}
      onTouchStart={handleStart}
    >
      {block.cells.map((cell, i) => (
        <div
          key={i}
          className="absolute rounded-md shadow-sm border border-black/10 transition-all duration-200"
          style={{
            left: `${cell.x * CELL_SIZE_REM}rem`,
            top: `${cell.y * CELL_SIZE_REM}rem`,
            width: `${CELL_SIZE_REM - 0.2}rem`,
            height: `${CELL_SIZE_REM - 0.2}rem`,
            backgroundColor: block.color,
          }}
        />
      ))}
    </div>
  );
};