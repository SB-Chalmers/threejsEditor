import React from 'react';
import { X } from 'lucide-react';
import type { BuildingConfig } from '../../types/building';

interface DrawingInspectorProps { config: BuildingConfig; onChange: (config: BuildingConfig) => void; onClose: () => void }
const COLORS = [0x7C8FA3, 0x6E9C9A, 0x879E7B, 0xB89A62, 0xB97867, 0xB87B84, 0x8D809B, 0x747B85];

export const DrawingInspector: React.FC<DrawingInspectorProps> = ({ config, onChange, onClose }) => (
  <aside className="model-drawing-inspector absolute right-0 top-0 z-30 h-full w-[304px] border-l border-slate-200 bg-white p-4 shadow-lg">
    <div className="flex items-center justify-between border-b border-slate-200 pb-3"><div><h2 className="text-[13px] font-semibold text-slate-900">New building</h2><p className="mt-0.5 text-[10px] text-slate-500">Defaults are retained for the next footprint.</p></div><button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Close drawing settings"><X className="h-4 w-4" /></button></div>
    <div className="space-y-5 pt-4 text-[11px]">
      <label className="block"><span className="mb-2 flex justify-between text-slate-600"><span>Floors</span><b>{config.floors}</b></span><input className="model-range w-full" type="range" min="1" max="50" value={config.floors} onChange={event => onChange({ ...config, floors: Number(event.target.value) })} /></label>
      <label className="block"><span className="mb-2 flex justify-between text-slate-600"><span>Floor height</span><b>{config.floorHeight.toFixed(1)} m</b></span><input className="model-range w-full" type="range" min="2.5" max="6" step="0.1" value={config.floorHeight} onChange={event => onChange({ ...config, floorHeight: Number(event.target.value) })} /></label>
      <div><div className="mb-2 text-slate-600">Default color</div><div className="grid grid-cols-4 gap-2">{COLORS.map(color => <button key={color} aria-label={`Color #${color.toString(16)}`} className={`h-7 rounded-md border-2 ${config.color === color ? 'border-blue-600 ring-2 ring-blue-100' : 'border-white ring-1 ring-slate-200'}`} style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }} onClick={() => onChange({ ...config, color })} />)}</div></div>
      <div className="rounded-md bg-blue-50 p-2.5 leading-4 text-blue-800">Click to place vertices. Click near the first point or double-click to finish.</div>
    </div>
  </aside>
);
