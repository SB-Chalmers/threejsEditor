import React, { useState } from 'react';
import { Activity, Camera, Focus, GitBranch, Grid3X3, View } from 'lucide-react';
import type { CameraType, CameraView } from '../core/ThreeJSCore';
import { CameraControlsDrawer } from './CameraControlsDrawer';

interface BuildingStats { count: number; totalGrossFloorArea: number; totalFloors: number }
interface BottomToolbarProps {
  showGrid: boolean; snapToGrid: boolean; showFPS: boolean; buildingStats: BuildingStats; currentCameraType: CameraType;
  onToggleGrid: () => void; onToggleSnap: () => void; onToggleFPS: () => void; onSwitchCameraType: (type: CameraType) => void; onSetCameraView: (view: CameraView) => void; onFitView: () => void; onOpenDesignGraph: () => void;
}

export const BottomToolbar: React.FC<BottomToolbarProps> = ({ showGrid, snapToGrid, showFPS, buildingStats, currentCameraType, onToggleGrid, onToggleSnap, onToggleFPS, onSwitchCameraType, onSetCameraView, onFitView, onOpenDesignGraph }) => {
  const [cameraOpen, setCameraOpen] = useState(false);
  const button = 'flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900';
  return <>
    <CameraControlsDrawer isOpen={cameraOpen} currentCameraType={currentCameraType} onClose={() => setCameraOpen(false)} onSwitchCameraType={onSwitchCameraType} onSetCameraView={onSetCameraView} />
    <div className="model-status-bar absolute bottom-3 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
      <div className="flex items-center gap-1">
        <button className={button} onClick={() => setCameraOpen(!cameraOpen)} title="Camera"><Camera className="h-3.5 w-3.5" /></button>
        <button className={button} onClick={onFitView} title="Frame all buildings"><Focus className="h-3.5 w-3.5" /></button>
        <button className={`${button} ${showGrid ? 'bg-blue-50 text-blue-600' : ''}`} onClick={onToggleGrid} title="Grid (G)"><View className="h-3.5 w-3.5" /></button>
        <button className={`${button} ${snapToGrid ? 'bg-blue-50 text-blue-600' : ''}`} onClick={onToggleSnap} title="Snap (S)"><Grid3X3 className="h-3.5 w-3.5" /></button>
        <button className={`${button} ${showFPS ? 'bg-blue-50 text-blue-600' : ''}`} onClick={onToggleFPS} title="Performance (F)"><Activity className="h-3.5 w-3.5" /></button>
        <div className="mx-1 h-4 w-px bg-slate-200" />
        <div className="model-status-label px-1 text-[11px] capitalize text-slate-600">{currentCameraType}</div>
        <div className="mx-1 h-4 w-px bg-slate-200" />
        <div className="model-status-label px-1 text-[11px] text-slate-600"><b className="text-slate-900">{buildingStats.count}</b> {buildingStats.count === 1 ? 'building' : 'buildings'}</div>
        <div className="model-status-label px-1 text-[11px] text-slate-600" title="Gross floor area"><b className="text-slate-900">{buildingStats.totalGrossFloorArea.toFixed(0)}</b> m² GFA</div>
        <button className={button} onClick={onOpenDesignGraph} title="Design history" aria-label="Open design history"><GitBranch className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  </>;
};
