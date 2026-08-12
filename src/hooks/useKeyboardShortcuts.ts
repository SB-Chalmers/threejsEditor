import { useEffect } from 'react';

interface KeyboardShortcutsProps {
  onDrawBuilding: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onToggleFPS: () => void;
  onShowConfig: () => void;
  onExport: () => void;
  onClearAll: () => void;
  onEscape: () => void;
  onUndoLastPoint: () => void;
  onSaveConfiguration: () => void;
  onImportConfiguration: () => void;
  onToggleSunController: () => void;
  isDrawing: boolean;
  isInitialized: boolean;
}

export const useKeyboardShortcuts = ({
  onDrawBuilding,
  onToggleGrid,
  onToggleSnap,
  onToggleFPS,
  onShowConfig,
  onExport,
  onClearAll,
  onEscape,
  onUndoLastPoint,
  onSaveConfiguration,
  onImportConfiguration,
  onToggleSunController,
  isDrawing,
  isInitialized
}: KeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement ||
          (event.target instanceof HTMLElement && event.target.isContentEditable)) {
        return;
      }

      const modified = event.ctrlKey || event.metaKey || event.altKey;
      if (modified) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          onSaveConfiguration();
        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
          event.preventDefault();
          onExport();
        }
        return;
      }

      // Handle shortcuts
      switch (event.key.toLowerCase()) {
        case 'd':
          // Allow 'D' to work even if already drawing - it will restart the drawing mode
          if (isInitialized) {
            event.preventDefault();
            onDrawBuilding();
          }
          break;
        case 'g':
          event.preventDefault();
          onToggleGrid();
          break;
        case 's':
          event.preventDefault();
          onToggleSnap();
          break;
        case 'f':
          event.preventDefault();
          onToggleFPS();
          break;
        case 'c':
          onShowConfig();
          break;
        case 'e':
          onExport();
          break;
        case 'delete':
        case 'backspace':
          // Only use Delete/Backspace as a shortcut if we're not currently typing in an input field
          // We don't require Ctrl/Cmd anymore to match the toolbar's Del shortcut behavior
          event.preventDefault();
          onClearAll();
          break;
        case 'escape':
          event.preventDefault();
          onEscape();
          break;
        case 'i':
          event.preventDefault();
          onImportConfiguration();
          break;
        case 'u':
          event.preventDefault();
          onToggleSunController();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onDrawBuilding,
    onToggleGrid,
    onToggleSnap,
    onToggleFPS,
    onShowConfig,
    onExport,
    onClearAll,
    onEscape,
    onUndoLastPoint,
    onSaveConfiguration,
    onImportConfiguration,
    onToggleSunController,
    isDrawing,
    isInitialized
  ]);
};
