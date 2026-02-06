'use client';

import { useState, useEffect, useRef } from 'react';

interface UseSplitterOptions {
  minWidth?: number;
  maxWidth?: number;
  initialWidth?: number;
}

/**
 * Hook for managing splitter/resizable panel dragging
 * Handles mouse events for resizing left panel width
 */
export const useSplitter = ({
  minWidth = 150,
  maxWidth = 600,
  initialWidth = 280,
}: UseSplitterOptions = {}) => {
  const [leftWidth, setLeftWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      
      // Restrict minimum and maximum width
      if (newWidth > minWidth && newWidth < maxWidth) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth]);

  return {
    leftWidth,
    isDragging,
    containerRef,
    handleMouseDown,
  };
};
