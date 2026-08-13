import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, RotateCcw, X } from 'lucide-react';
import type { BuildingEditDraft } from '../hooks/useBuildingEditSession';
import { DEFAULT_BUILDING_COLOR } from '../types/building';
import { DEFAULT_FACADE_PARAMETERS } from '../services/FacadeGeometry';
import { getEPSMConstructionOptions, type EPSMConstructionOptions } from '../services/EPSMService';
import { calculateBuildingMetrics, validateFootprint } from '../utils/buildingMetrics';

export type { BuildingEditDraft } from '../hooks/useBuildingEditSession';

const MUTED_COLORS = [
  { name: 'Light gray', value: DEFAULT_BUILDING_COLOR },
  { name: 'Slate', value: 0x7C8FA3 },
  { name: 'Teal', value: 0x6E9C9A },
  { name: 'Sage', value: 0x879E7B },
  { name: 'Ochre', value: 0xB89A62 },
  { name: 'Terracotta', value: 0xB97867 },
  { name: 'Rose', value: 0xB87B84 },
  { name: 'Plum', value: 0x8D809B },
  { name: 'Graphite', value: 0x747B85 },
];

interface BuildingEditPanelProps {
  draft: BuildingEditDraft;
  baseDraft: BuildingEditDraft;
  onChange: (draft: BuildingEditDraft) => void;
  onReset: () => void;
  onCommit: () => void;
  onCancel: () => void;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-[11px] font-medium text-slate-600">{label}</span>
    {children}
  </label>
);

const Section = ({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) => (
  <section className="border-b border-slate-200">
    <button type="button" onClick={onToggle} className="flex h-10 w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
      {title}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="space-y-4 pb-4">{children}</div>}
  </section>
);

export const BuildingEditPanel: React.FC<BuildingEditPanelProps> = ({ draft, baseDraft, onChange, onReset, onCommit, onCancel }) => {
  const [open, setOpen] = useState({ identity: true, massing: false, facade: true, constructions: false, program: false, systems: false });
  const [epsm, setEpsm] = useState<EPSMConstructionOptions | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getEPSMConstructionOptions(controller.signal).then(setEpsm).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const metrics = useMemo(() => calculateBuildingMetrics(draft.points, draft.floors, draft.floorHeight), [draft.points, draft.floors, draft.floorHeight]);
  const footprintError = useMemo(() => validateFootprint(draft.points), [draft.points]);
  const changed = JSON.stringify(draft) !== JSON.stringify(baseDraft);
  const inputClass = 'h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  const commit = () => { if (!footprintError) onCommit(); };

  const toggle = (key: keyof typeof open) => setOpen(previous => ({ ...previous, [key]: !previous[key] }));
  const optionsFor = (type: 'wall' | 'floor' | 'roof' | 'window', current: string | undefined) => {
    const options = epsm?.[type] ?? [];
    return current && !options.some(option => option.value === current) ? [{ value: current, label: `${current} (current)` }, ...options] : options;
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div data-testid="building-edit-backdrop" className="fixed inset-0 bg-slate-900/10 pointer-events-auto" onClick={onCancel} />
      <aside className="model-inspector pointer-events-auto fixed bottom-0 right-0 top-12 z-50 flex w-[304px] flex-col border-l border-slate-200 bg-white shadow-xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-start justify-between">
            <div><h2 className="text-[13px] font-semibold text-slate-900">Edit building</h2><p className="mt-0.5 text-[11px] text-slate-500">{draft.name || 'Untitled building'}</p></div>
            <button type="button" aria-label="Cancel building edits" onClick={onCancel} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-2.5">
            <div><div className="text-[10px] text-slate-500">GFA</div><div className="text-[13px] font-semibold tabular-nums text-slate-800">{metrics.grossFloorArea.toFixed(1)} m²</div></div>
            <div><div className="text-[10px] text-slate-500">Total height</div><div className="text-[13px] font-semibold tabular-nums text-slate-800">{metrics.totalHeight.toFixed(1)} m</div></div>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4">
          <Section title="Identity" open={open.identity} onToggle={() => toggle('identity')}>
            <Field label="Name"><input className={inputClass} value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} /></Field>
            <Field label="Description"><textarea className={`${inputClass} h-16 resize-none py-2`} value={draft.description} onChange={event => onChange({ ...draft, description: event.target.value })} /></Field>
          </Section>

          <Section title="Form & Massing" open={open.massing} onToggle={() => toggle('massing')}>
            <Field label={`Floors · ${draft.floors}`}><input aria-label="Floors" type="range" min="1" max="50" value={draft.floors} onChange={event => onChange({ ...draft, floors: Number(event.target.value) })} className="model-range w-full" /></Field>
            <Field label={`Floor height · ${draft.floorHeight.toFixed(1)} m`}><input aria-label="Floor height" type="range" min="2.5" max="6" step="0.1" value={draft.floorHeight} onChange={event => onChange({ ...draft, floorHeight: Number(event.target.value) })} className="model-range w-full" /></Field>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600">
              Drag the solid footprint vertices in the scene. Click a midpoint to insert a vertex; select a vertex and press Delete to remove it.
              <div className="mt-1 font-medium">{draft.points.length} vertices · {metrics.footprintArea.toFixed(1)} m² footprint</div>
            </div>
            {footprintError && <p role="alert" className="text-[11px] font-medium text-rose-600">{footprintError}</p>}
            <div>
              <div className="mb-2 text-[11px] font-medium text-slate-600">Building color</div>
              <div className="grid grid-cols-4 gap-2">
                {MUTED_COLORS.map(color => <button key={color.name} type="button" aria-label={color.name} title={color.name} onClick={() => onChange({ ...draft, color: color.value })} className={`h-7 rounded-md border-2 ${draft.color === color.value ? 'border-blue-600 ring-2 ring-blue-100' : 'border-white ring-1 ring-slate-200'}`} style={{ backgroundColor: `#${color.value.toString(16).padStart(6, '0')}` }} />)}
              </div>
            </div>
          </Section>

          <Section title="Façade" open={open.facade} onToggle={() => toggle('facade')}>
            <Field label={`Window-to-wall ratio · ${Math.round((draft.window_to_wall_ratio ?? DEFAULT_FACADE_PARAMETERS.wwr) * 100)}%`}><input aria-label="Window-to-wall ratio" type="range" min="0" max="0.95" step="0.01" value={draft.window_to_wall_ratio} onChange={event => onChange({ ...draft, window_to_wall_ratio: Number(event.target.value) })} className="model-range w-full" /></Field>
            <label className="flex items-center gap-2 text-[11px] text-slate-700"><input type="checkbox" checked={draft.window_overhang ?? false} onChange={event => onChange({ ...draft, window_overhang: event.target.checked })} /> Additional window overhang</label>
            <Field label={`Additional depth · ${(draft.window_overhang_depth ?? 0).toFixed(2)} m (total ${((draft.window_overhang ? draft.window_overhang_depth ?? 0 : 0) + DEFAULT_FACADE_PARAMETERS.wallThickness).toFixed(2)} m)`}><input aria-label="Additional overhang depth" type="range" min="0" max="2" step="0.05" value={draft.window_overhang_depth ?? 0} onChange={event => onChange({ ...draft, window_overhang_depth: Number(event.target.value) })} className="model-range w-full" /></Field>
            <p className="text-[10px] leading-4 text-slate-500">A {DEFAULT_FACADE_PARAMETERS.wallThickness.toFixed(2)} m wall-thickness overhang and side fins are always included.</p>
          </Section>

          <Section title="Constructions" open={open.constructions} onToggle={() => toggle('constructions')}>
            {(['wall', 'floor', 'roof', 'window'] as const).map(type => {
              const key = `${type}_construction` as const;
              const current = draft[key];
              return <Field key={type} label={`${type[0].toUpperCase()}${type.slice(1)}`}><select className={inputClass} value={current} onChange={event => onChange({ ...draft, [key]: event.target.value })}>{optionsFor(type, current).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;
            })}
          </Section>

          <Section title="Program" open={open.program} onToggle={() => toggle('program')}>
            <Field label="Building program"><select className={inputClass} value={draft.building_program} onChange={event => onChange({ ...draft, building_program: event.target.value })}>{['Office', 'Residential', 'Retail', 'School', 'Hospital'].map(value => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Structural system"><select className={inputClass} value={draft.structural_system} onChange={event => onChange({ ...draft, structural_system: event.target.value })}>{['Concrete', 'Timber', 'Masonry'].map(value => <option key={value}>{value}</option>)}</select></Field>
          </Section>

          <Section title="Systems" open={open.systems} onToggle={() => toggle('systems')}>
            <Field label="HVAC"><select className={inputClass} value={draft.hvac_system} onChange={event => onChange({ ...draft, hvac_system: event.target.value })}>{['Default HVAC', 'VAV', 'CAV', 'Radiant', 'Split System'].map(value => <option key={value}>{value}</option>)}</select></Field>
            <label className="flex items-center gap-2 text-[11px] text-slate-700"><input type="checkbox" checked={draft.natural_ventilation ?? false} onChange={event => onChange({ ...draft, natural_ventilation: event.target.checked })} /> Natural ventilation</label>
          </Section>
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
          <button type="button" onClick={onReset} disabled={!changed} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
          <div className="flex gap-2"><button type="button" onClick={onCancel} className="h-8 rounded-md px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button type="button" onClick={commit} disabled={Boolean(footprintError)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"><Check className="h-3.5 w-3.5" /> Done</button></div>
        </footer>
      </aside>
    </div>
  );
};
