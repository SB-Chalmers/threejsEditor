import { useEffect, useLayoutEffect, useRef } from 'react';

export const useClickHandler = (
  containerRef: React.RefObject<HTMLElement>,
  onSingleClick: (event: MouseEvent, container: HTMLElement) => void,
  onDoubleClick: () => void,
  onMouseMove?: (event: MouseEvent, container: HTMLElement) => void,
  onBuildingInteraction?: (event: MouseEvent, container: HTMLElement) => void,
  isDrawing?: React.RefObject<boolean> // Accept a ref
) => {
  const clickTimeoutRef = useRef<number | null>(null);
  const isDoubleClickRef = useRef(false);
  const lastClickTimeRef = useRef(0);
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const mouseMoveThrottleRef = useRef<number | null>(null);

  // The editor passes inline callbacks. Keep listeners attached across renders,
  // while queued movement always reads the latest committed drawing state.
  const callbacksRef = useRef({ onSingleClick, onDoubleClick, onMouseMove, onBuildingInteraction, isDrawing });
  useLayoutEffect(() => {
    callbacksRef.current = { onSingleClick, onDoubleClick, onMouseMove, onBuildingInteraction, isDrawing };
  }, [onSingleClick, onDoubleClick, onMouseMove, onBuildingInteraction, isDrawing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      console.warn('Container not available for click handler');
      return;
    }

    console.log('Setting up click handlers on container');
    let pendingMouseMove: MouseEvent | null = null;

    const handleMouseDown = (event: MouseEvent) => {
      mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
      console.log('Mouse down at:', mouseDownPosRef.current);
    };

    const handleMouseMove = (event: MouseEvent) => {
      // Coalesce movement without losing the cursor's final position this frame.
      pendingMouseMove = event;
      if (mouseMoveThrottleRef.current !== null) {
        return;
      }
      
      mouseMoveThrottleRef.current = requestAnimationFrame(() => {
        mouseMoveThrottleRef.current = null;
        const latestEvent = pendingMouseMove;
        pendingMouseMove = null;
        if (!latestEvent) return;
        const { onMouseMove, onBuildingInteraction } = callbacksRef.current;
        
        // Call onMouseMove for drawing preview
        if (onMouseMove) {
          onMouseMove(latestEvent, container);
        }
        
        // Always call building interaction on mouse move for hover management
        if (typeof onBuildingInteraction === 'function') {
          onBuildingInteraction(latestEvent, container);
        }
      });
    };

    const handleMouseClick = (event: MouseEvent) => {
      const { onSingleClick, onDoubleClick, onBuildingInteraction, isDrawing } = callbacksRef.current;
      console.log('Mouse click event:', { 
        clientX: event.clientX, 
        clientY: event.clientY,
        isDrawing: isDrawing?.current,
        timestamp: Date.now()
      });

      if (!mouseDownPosRef.current) {
        console.log('No mouse down position recorded');
        return;
      }

      // Check for drag - if user dragged, don't treat as click
      const dx = Math.abs(event.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(event.clientY - mouseDownPosRef.current.y);
      
      if (dx > 3 || dy > 3) {
        console.log('Mouse drag detected, ignoring click');
        mouseDownPosRef.current = null;
        return;
      }

      // Handle click timing for single/double click detection
      const now = Date.now();
      const timeDiff = now - lastClickTimeRef.current;

      if (timeDiff < 300) { // Double click detected
        console.log('Double click detected, finishing building');
        isDoubleClickRef.current = true;
        
        if (clickTimeoutRef.current) {
          window.clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }
        
        if (isDrawing?.current) {
          onDoubleClick();
        }
      } else {
        // Single click - immediate processing for drawing mode
        console.log('Single click detected, processing immediately');
        isDoubleClickRef.current = false;
        
        if (clickTimeoutRef.current) {
          window.clearTimeout(clickTimeoutRef.current);
        }
        
        // Handle single clicks appropriately
        if (isDrawing?.current) {
          console.log('Calling onSingleClick for drawing mode');
          onSingleClick(event, container);
        } else if (typeof onBuildingInteraction === 'function') {
          // For building interaction, call immediately but only for selection/tooltip
          console.log('Calling building interaction for click (selection only)');
          onBuildingInteraction(event, container);
        }
      }

      lastClickTimeRef.current = now;
      mouseDownPosRef.current = null;
    };

    // Use click event instead of mouseup for more reliable detection
    container.addEventListener('mousedown', handleMouseDown, { passive: true });
    container.addEventListener('click', handleMouseClick, { passive: true });
    container.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      console.log('Cleaning up click handlers');
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('click', handleMouseClick);
      container.removeEventListener('mousemove', handleMouseMove);
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
      if (mouseMoveThrottleRef.current !== null) {
        cancelAnimationFrame(mouseMoveThrottleRef.current);
        mouseMoveThrottleRef.current = null;
      }
      pendingMouseMove = null;
      mouseDownPosRef.current = null;
    };
  }, [containerRef]);
};
