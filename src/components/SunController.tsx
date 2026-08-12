import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, RotateCcw, Sun, X } from 'lucide-react';
import { calculateSunPosition, type SunPosition } from '../utils/sunPosition';

interface SunControllerProps {
  onSunPositionChange: (position: SunPosition) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const todayAtTwo = () => {
  const date = new Date();
  date.setHours(14, 0, 0, 0);
  return date;
};

const toDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toTimeLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export const SunController: React.FC<SunControllerProps> = ({
  onSunPositionChange,
  isOpen,
  onToggle,
}) => {
  const [selectedDate, setSelectedDate] = useState(todayAtTwo);
  const [minutes, setMinutes] = useState(14 * 60);
  const selectedDateTime = useMemo(() => {
    const next = new Date(selectedDate);
    next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return next;
  }, [minutes, selectedDate]);
  const sunPosition = useMemo(() => calculateSunPosition(selectedDateTime), [selectedDateTime]);

  useEffect(() => {
    onSunPositionChange(sunPosition);
  }, [onSunPositionChange, sunPosition]);

  if (!isOpen) return null;

  const reset = () => {
    setSelectedDate(todayAtTwo());
    setMinutes(14 * 60);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/20 p-4" onMouseDown={onToggle}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sun-control-title"
        className="w-full max-w-[420px] rounded-xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500" />
            <h2 id="sun-control-title" className="text-[13px] font-semibold text-slate-800">Sun position</h2>
          </div>
          <button type="button" onClick={onToggle} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Close sun controls">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 p-4 text-[12px]">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-600"><Calendar className="h-3.5 w-3.5" /> Date</span>
            <input
              type="date"
              value={toDateInput(selectedDate)}
              onChange={(event) => {
                const [year, month, day] = event.target.value.split('-').map(Number);
                setSelectedDate(new Date(year, month - 1, day, 14, 0, 0, 0));
              }}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium text-slate-600">Time</span>
              <span className="font-semibold tabular-nums text-slate-900">{toTimeLabel(minutes)}</span>
            </div>
            <input
              aria-label="Time of day"
              type="range"
              min={0}
              max={23 * 60 + 45}
              step={15}
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
              className="model-range w-full"
            />
            <div className="mt-3 grid grid-cols-4 gap-2">
              {[9, 12, 14, 17].map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => setMinutes(hour * 60)}
                  className={`h-8 rounded-md border text-[11px] font-medium ${minutes === hour * 60 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {String(hour).padStart(2, '0')}:00
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
            <div><div className="text-slate-500">Elevation</div><div className="mt-0.5 text-base font-semibold tabular-nums text-slate-800">{sunPosition.elevation.toFixed(1)}°</div></div>
            <div><div className="text-slate-500">Azimuth</div><div className="mt-0.5 text-base font-semibold tabular-nums text-slate-800">{sunPosition.azimuth.toFixed(1)}°</div></div>
          </div>
        </div>

        <footer className="flex justify-end border-t border-slate-200 px-4 py-3">
          <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50">
            <RotateCcw className="h-3.5 w-3.5" /> Reset to today, 14:00
          </button>
        </footer>
      </section>
    </div>
  );
};
