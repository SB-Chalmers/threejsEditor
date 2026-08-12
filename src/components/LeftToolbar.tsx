import React from 'react';
import { CloudSun, Download, Pencil, Play, Trash2, Upload } from 'lucide-react';

interface LeftToolbarProps {
  isDrawing: boolean;
  isInitialized: boolean;
  hasBuildings: boolean;
  onStartDrawing: () => void;
  onExport: () => void;
  onClearAll: () => void;
  onSaveConfiguration: () => void;
  onImportConfiguration: () => void;
  onToggleSunController: () => void;
}

const Tool = ({ icon: Icon, label, shortcut, onClick, disabled, active }: { icon: React.ElementType; label: string; shortcut?: string; onClick: () => void; disabled?: boolean; active?: boolean }) => (
  <button type="button" aria-label={label} title={`${label}${shortcut ? ` (${shortcut})` : ''}`} onClick={onClick} disabled={disabled} className={`model-tool relative flex h-9 w-9 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}><Icon className="h-4 w-4" /></button>
);

export const LeftToolbar: React.FC<LeftToolbarProps> = ({ isDrawing, isInitialized, hasBuildings, onStartDrawing, onExport, onClearAll, onSaveConfiguration, onImportConfiguration, onToggleSunController }) => (
  <nav className="model-tool-rail absolute left-2 top-1/2 z-40 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-1 shadow-lg" aria-label="Model tools">
    <div className="flex flex-col gap-1">
      <Tool icon={Pencil} label="Draw building" shortcut="D" onClick={onStartDrawing} disabled={!isInitialized || isDrawing} active={isDrawing} />
      <Tool icon={Play} label="Run studies" shortcut="Ctrl+S" onClick={onSaveConfiguration} disabled={!isInitialized || !hasBuildings} />
      <div className="mx-1 h-px bg-slate-200" />
      <Tool icon={Upload} label="Import" shortcut="I" onClick={onImportConfiguration} disabled={!isInitialized} />
      <Tool icon={Download} label="Export" shortcut="Ctrl+E" onClick={onExport} disabled={!hasBuildings} />
      <Tool icon={Trash2} label="Clear buildings" shortcut="Delete" onClick={onClearAll} disabled={!hasBuildings} />
      <div className="mx-1 h-px bg-slate-200" />
      <Tool icon={CloudSun} label="Sun position" shortcut="U" onClick={onToggleSunController} disabled={!isInitialized} />
    </div>
  </nav>
);
