import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, RotateCcw, X } from 'lucide-react';
import type { BuildingConfig, BuildingData, Point3D } from '../types/building';
import { clampWwr, DEFAULT_FACADE_PARAMETERS } from '../services/FacadeGeometry';
import { getEPSMConstructionOptions, type EPSMConstructionOptions } from '../services/EPSMService';
import { calculateBuildingMetrics, validateFootprint } from '../utils/buildingMetrics';

export type BuildingEditDraft = BuildingConfig & {
  name: string;
  description: string;
  points: Point3D[];
};

const MUTED_COLORS = [
  { name: 'Slate', value: 0x7C8FA3 },
  { name: 'Teal', value: 0x6E9C9A },
  { name: 'Sage', value: 0x879E7B },
  { name: 'Ochre', value: 0xB89A62 },
  { name: 'Terracotta', value: 0xB97867 },
  { name: 'Rose', value: 0xB87B84 },
  { name: 'Plum', value: 0x8D809B },
  { name: 'Graphite', value: 0x747B85 },
];

const fromBuilding = (building: BuildingData): BuildingEditDraft => ({
  name: building.name ?? '',
  description: building.description ?? '',
  points: building.points.map(point => ({ ...point })),
  floors: building.floors,
  floorHeight: building.floorHeight,
  color: building.color ?? 0x7C8FA3,
  window_to_wall_ratio: clampWwr(building.window_to_wall_ratio),
  window_overhang: building.window_overhang ?? false,
  window_overhang_depth: building.window_overhang_depth ?? 0,
  wall_construction: building.wall_construction ?? 'Default Wall',
  floor_construction: building.floor_construction ?? 'Default Floor',
  roof_construction: building.roof_construction ?? 'Default Roof',
  window_construction: building.window_construction ?? 'Default Window',
  structural_system: building.structural_system ?? 'Concrete',
  building_program: building.building_program ?? 'Office',
  hvac_system: building.hvac_system ?? 'Default HVAC',
  natural_ventilation: building.natural_ventilation ?? false,
});

interface BuildingEditPanelProps {
  building: BuildingData;
  footprintPoints?: Point3D[];
  onPreview?: (draft: BuildingEditDraft) => void;
  onCommit: (draft: BuildingEditDraft) => void;
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

export const BuildingEditPanel: React.FC<BuildingEditPanelProps> = ({ building, footprintPoints, onPreview, onCommit, onCancel }) => {
  const [edited, setEdited] = useState(() => fromBuilding(building));
  const [open, setOpen] = useState({ identity: true, massing: false, facade: true, constructions: false, program: false, systems: false });
  const [epsm, setEpsm] = useState<EPSMConstructionOptions | null>(null);
  const openingRef = useRef(fromBuilding(building));
  const timerRef = useRef<number | null>(null);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const schedulePreview = useCallback((draft: BuildingEditDraft) => {
    cancelTimer();
    timerRef.current = window.setTimeout(() => {
      onPreview?.(draft);
      timerRef.current = null;
    }, 50);
  }, [cancelTimer, onPreview]);

  const setField = <K extends keyof BuildingEditDraft>(key: K, value: BuildingEditDraft[K]) => {
    setEdited(previous => {
      const next = { ...previous, [key]: key === 'window_to_wall_ratio' ? clampWwr(value) : value } as BuildingEditDraft;
      schedulePreview(next);
      return next;
    });
  };

  useEffect(() => {
    cancelTimer();
    const next = fromBuilding(building);
    openingRef.current = next;
    setEdited(next);
  }, [building, cancelTimer]);

  useEffect(() => {
    if (!footprintPoints) return;
    setEdited(previous => {
      if (JSON.stringify(previous.points) === JSON.stringify(footprintPoints)) return previous;
      const next = { ...previous, points: footprintPoints.map(point => ({ ...point })) };
      onPreview?.(next);
      return next;
    });
  }, [footprintPoints, onPreview]);

  useEffect(() => {
    const controller = new AbortController();
    getEPSMConstructionOptions(controller.signal).then(setEpsm).catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => cancelTimer, [cancelTimer]);

  const metrics = useMemo(() => calculateBuildingMetrics(edited.points, edited.floors, edited.floorHeight), [edited.points, edited.floors, edited.floorHeight]);
  const footprintError = useMemo(() => validateFootprint(edited.points), [edited.points]);
  const changed = JSON.stringify(edited) !== JSON.stringify(openingRef.current);
  const inputClass = 'h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

  const handleCancel = () => { cancelTimer(); onCancel(); };
  const reset = () => {
    cancelTimer();
    const next = { ...openingRef.current, points: openingRef.current.points.map(point => ({ ...point })) };
    setEdited(next);
    onPreview?.(next);
  };
  const commit = () => {
    cancelTimer();
    if (!footprintError) onCommit({ ...edited, window_to_wall_ratio: clampWwr(edited.window_to_wall_ratio) });
  };

  const toggle = (key: keyof typeof open) => setOpen(previous => ({ ...previous, [key]: !previous[key] }));
  const optionsFor = (type: 'wall' | 'floor' | 'roof' | 'window', current: string | undefined) => {
    const options = epsm?.[type] ?? [];
    return current && !options.some(option => option.value === current) ? [{ value: current, label: `${current} (current)` }, ...options] : options;
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div data-testid="building-edit-backdrop" className="fixed inset-0 bg-slate-900/10 pointer-events-auto" onClick={handleCancel} />
      <aside className="model-inspector pointer-events-auto fixed bottom-0 right-0 top-12 z-50 flex w-[304px] flex-col border-l border-slate-200 bg-white shadow-xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-start justify-between">
            <div><h2 className="text-[13px] font-semibold text-slate-900">Edit building</h2><p className="mt-0.5 text-[11px] text-slate-500">{edited.name || 'Untitled building'}</p></div>
            <button type="button" aria-label="Cancel building edits" onClick={handleCancel} className="rounded p-1 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-slate-50 p-2.5">
            <div><div className="text-[10px] text-slate-500">GFA</div><div className="text-[13px] font-semibold tabular-nums text-slate-800">{metrics.grossFloorArea.toFixed(1)} m²</div></div>
            <div><div className="text-[10px] text-slate-500">Total height</div><div className="text-[13px] font-semibold tabular-nums text-slate-800">{metrics.totalHeight.toFixed(1)} m</div></div>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-4">
          <Section title="Identity" open={open.identity} onToggle={() => toggle('identity')}>
            <Field label="Name"><input className={inputClass} value={edited.name} onChange={event => setField('name', event.target.value)} /></Field>
            <Field label="Description"><textarea className={`${inputClass} h-16 resize-none py-2`} value={edited.description} onChange={event => setField('description', event.target.value)} /></Field>
          </Section>

          <Section title="Form & Massing" open={open.massing} onToggle={() => toggle('massing')}>
            <Field label={`Floors · ${edited.floors}`}><input aria-label="Floors" type="range" min="1" max="50" value={edited.floors} onChange={event => setField('floors', Number(event.target.value))} className="model-range w-full" /></Field>
            <Field label={`Floor height · ${edited.floorHeight.toFixed(1)} m`}><input aria-label="Floor height" type="range" min="2.5" max="6" step="0.1" value={edited.floorHeight} onChange={event => setField('floorHeight', Number(event.target.value))} className="model-range w-full" /></Field>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-[11px] text-slate-600">
              Drag the solid footprint vertices in the scene. Click a midpoint to insert a vertex; select a vertex and press Delete to remove it.
              <div className="mt-1 font-medium">{edited.points.length} vertices · {metrics.footprintArea.toFixed(1)} m² footprint</div>
            </div>
            {footprintError && <p role="alert" className="text-[11px] font-medium text-rose-600">{footprintError}</p>}
            <div>
              <div className="mb-2 text-[11px] font-medium text-slate-600">Building color</div>
              <div className="grid grid-cols-4 gap-2">
                {MUTED_COLORS.map(color => <button key={color.name} type="button" aria-label={color.name} title={color.name} onClick={() => setField('color', color.value)} className={`h-7 rounded-md border-2 ${edited.color === color.value ? 'border-blue-600 ring-2 ring-blue-100' : 'border-white ring-1 ring-slate-200'}`} style={{ backgroundColor: `#${color.value.toString(16).padStart(6, '0')}` }} />)}
              </div>
            </div>
          </Section>

          <Section title="Façade" open={open.facade} onToggle={() => toggle('facade')}>
            <Field label={`Window-to-wall ratio · ${Math.round((edited.window_to_wall_ratio ?? DEFAULT_FACADE_PARAMETERS.wwr) * 100)}%`}><input aria-label="Window-to-wall ratio" type="range" min="0" max="0.95" step="0.01" value={edited.window_to_wall_ratio} onChange={event => setField('window_to_wall_ratio', Number(event.target.value))} className="model-range w-full" /></Field>
            <label className="flex items-center gap-2 text-[11px] text-slate-700"><input type="checkbox" checked={edited.window_overhang ?? false} onChange={event => setField('window_overhang', event.target.checked)} /> Additional window overhang</label>
            <Field label={`Additional depth · ${(edited.window_overhang_depth ?? 0).toFixed(2)} m (total ${((edited.window_overhang ? edited.window_overhang_depth ?? 0 : 0) + DEFAULT_FACADE_PARAMETERS.wallThickness).toFixed(2)} m)`}><input aria-label="Additional overhang depth" type="range" min="0" max="2" step="0.05" value={edited.window_overhang_depth ?? 0} onChange={event => setField('window_overhang_depth', Number(event.target.value))} className="model-range w-full" /></Field>
            <p className="text-[10px] leading-4 text-slate-500">A {DEFAULT_FACADE_PARAMETERS.wallThickness.toFixed(2)} m wall-thickness overhang and side fins are always included.</p>
          </Section>

          <Section title="Constructions" open={open.constructions} onToggle={() => toggle('constructions')}>
            {(['wall', 'floor', 'roof', 'window'] as const).map(type => {
              const key = `${type}_construction` as const;
              const current = edited[key];
              return <Field key={type} label={`${type[0].toUpperCase()}${type.slice(1)}`}><select className={inputClass} value={current} onChange={event => setField(key, event.target.value)}>{optionsFor(type, current).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>;
            })}
          </Section>

          <Section title="Program" open={open.program} onToggle={() => toggle('program')}>
            <Field label="Building program"><select className={inputClass} value={edited.building_program} onChange={event => setField('building_program', event.target.value)}>{['Office', 'Residential', 'Retail', 'School', 'Hospital'].map(value => <option key={value}>{value}</option>)}</select></Field>
            <Field label="Structural system"><select className={inputClass} value={edited.structural_system} onChange={event => setField('structural_system', event.target.value)}>{['Concrete', 'Timber', 'Masonry'].map(value => <option key={value}>{value}</option>)}</select></Field>
          </Section>

          <Section title="Systems" open={open.systems} onToggle={() => toggle('systems')}>
            <Field label="HVAC"><select className={inputClass} value={edited.hvac_system} onChange={event => setField('hvac_system', event.target.value)}>{['Default HVAC', 'VAV', 'CAV', 'Radiant', 'Split System'].map(value => <option key={value}>{value}</option>)}</select></Field>
            <label className="flex items-center gap-2 text-[11px] text-slate-700"><input type="checkbox" checked={edited.natural_ventilation ?? false} onChange={event => setField('natural_ventilation', event.target.checked)} /> Natural ventilation</label>
          </Section>
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3">
          <button type="button" onClick={reset} disabled={!changed} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
          <div className="flex gap-2"><button type="button" onClick={handleCancel} className="h-8 rounded-md px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button type="button" onClick={commit} disabled={Boolean(footprintError)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"><Check className="h-3.5 w-3.5" /> Done</button></div>
        </footer>
      </aside>
    </div>
  );
};
