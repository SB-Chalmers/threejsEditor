import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface DaylightLegendProps { mode: 'df' | 'sda'; isVisible: boolean; onToggle: () => void }
export const DaylightLegend: React.FC<DaylightLegendProps> = ({ mode, isVisible, onToggle }) => (
  <aside className="model-daylight-legend pointer-events-auto absolute z-30 min-w-[232px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
    <div className="mb-2 flex items-center justify-between gap-3"><div className="text-[11px] font-semibold text-slate-800">{mode === 'df' ? 'Daylight Factor (DF)' : 'sDA · 300 lux / 50%'}</div><button type="button" onClick={onToggle} className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100" aria-label={isVisible ? 'Hide daylight visualization' : 'Show daylight visualization'} aria-pressed={isVisible}>{isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button></div>
    {mode === 'df' ? <><div className="h-2.5 rounded-full" style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 10%, #06b6d4 20%, #22c55e 50%, #f59e0b 80%, #ef4444 100%)' }} /><div className="mt-1 flex justify-between text-[9px] text-slate-500"><span>0%</span><b className="text-cyan-700">2% target</b><span>5%</span><span>10%+</span></div></> : <div className="flex gap-4 text-[10px]"><span className="text-emerald-700">● Pass ≥ 50%</span><span className="text-rose-700">● Fail &lt; 50%</span></div>}
  </aside>
);
