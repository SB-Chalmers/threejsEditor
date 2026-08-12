import React from 'react';
import { X } from 'lucide-react';

interface FloatingInstructionsProps { mode: 'drawing' | 'selection' | 'welcome' | null; drawingPoints?: number; buildingCount?: number; onDismissWelcome?: () => void }
export const FloatingInstructions: React.FC<FloatingInstructionsProps> = ({ mode, drawingPoints = 0, buildingCount = 0, onDismissWelcome }) => {
  if (!mode) return null;
  const message = mode === 'drawing'
    ? `${drawingPoints} vertices · click near the first point or double-click to finish`
    : mode === 'selection' && buildingCount > 0
      ? 'Click a building to inspect or edit it. Press D to draw.'
      : 'A sample building is ready. Click it to start editing.';
  return <div className="model-context-hint pointer-events-auto absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 shadow-md">
    <span>{message}</span>
    {mode !== 'drawing' && <button type="button" onClick={onDismissWelcome} className="rounded p-0.5 text-slate-400 hover:bg-slate-100" aria-label="Dismiss hint"><X className="h-3.5 w-3.5" /></button>}
  </div>;
};
