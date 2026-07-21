import React, { useEffect, useMemo, useState } from 'react';
import { X, Sun, Activity, Filter } from 'lucide-react';
import { DaylightRunSummary, DaylightSensorPoint } from '../../types/daylight';

interface DaylightResultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  buildingName: string;
  result: DaylightRunSummary;
  onApplyVisualization: (points: DaylightSensorPoint[], mode: MetricMode) => void;
}

type MetricMode = 'df' | 'sda';

export const DaylightResultsDialog: React.FC<DaylightResultsDialogProps> = ({
  isOpen,
  onClose,
  buildingName,
  result,
  onApplyVisualization
}) => {
  const [mode, setMode] = useState<MetricMode>('df');
  const [showPassingOnly, setShowPassingOnly] = useState(false);

  const hasSda = Boolean(result.sdaPoints && result.sdaPoints.length > 0);

  const visiblePointEntries = useMemo(() => {
    if (mode === 'df' || !result.sdaPoints) {
      return result.points.map((point, index) => ({ point, index }));
    }

    if (!showPassingOnly || !result.sdaPassMask) {
      return result.sdaPoints.map((point, index) => ({ point, index }));
    }

    return result.sdaPoints
      .map((point, index) => ({ point, index }))
      .filter(({ index }) => result.sdaPassMask?.[index]);
  }, [mode, showPassingOnly, result]);

  const visiblePoints = useMemo(
    () => visiblePointEntries.map(({ point }) => point),
    [visiblePointEntries]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    onApplyVisualization(visiblePoints, mode);
  }, [isOpen, visiblePoints, mode, onApplyVisualization]);

  const planView = useMemo(() => {
    if (visiblePointEntries.length === 0) {
      return null;
    }

    const points = visiblePointEntries.map(({ point }) => point);
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minZ = Math.min(...points.map((point) => point.z));
    const maxZ = Math.max(...points.map((point) => point.z));
    const minValue = Math.min(...points.map((point) => point.value));
    const maxValue = Math.max(...points.map((point) => point.value));

    const epsilon = 1e-6;
    const sortedX = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
    const sortedZ = [...new Set(points.map((point) => point.z))].sort((a, b) => a - b);

    const minDelta = (values: number[]): number => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 1; i < values.length; i += 1) {
        const delta = values[i] - values[i - 1];
        if (delta > epsilon && delta < best) {
          best = delta;
        }
      }
      return Number.isFinite(best) ? best : Number.POSITIVE_INFINITY;
    };

    const spacing = Math.min(minDelta(sortedX), minDelta(sortedZ));
    const fallbackSpacing = Math.max(
      (maxX - minX) / Math.max(1, Math.sqrt(result.points.length)),
      (maxZ - minZ) / Math.max(1, Math.sqrt(result.points.length)),
      0.4
    );
    const worldCell = Number.isFinite(spacing) ? Math.max(0.1, spacing * 0.9) : fallbackSpacing;

    const viewSize = 320;
    const margin = 14;
    const innerSize = viewSize - margin * 2;
    const worldWidth = Math.max(maxX - minX, worldCell);
    const worldHeight = Math.max(maxZ - minZ, worldCell);
    const scale = Math.min(innerSize / worldWidth, innerSize / worldHeight);
    const contentWidth = worldWidth * scale;
    const contentHeight = worldHeight * scale;
    const offsetX = margin + (innerSize - contentWidth) / 2;
    const offsetY = margin + (innerSize - contentHeight) / 2;
    const cellSizePx = Math.max(2, worldCell * scale);

    const normalize = (value: number): number => {
      if (maxValue <= minValue) {
        return 0.5;
      }
      return Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
    };

    const getDfColorForNormalizedValue = (value: number): string => {
      const clamp = (v: number) => Math.max(0, Math.min(1, v));
      const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * clamp(t));
      const lerpColor = (start: [number, number, number], end: [number, number, number], t: number) => {
        return `rgb(${mix(start[0], end[0], t)}, ${mix(start[1], end[1], t)}, ${mix(start[2], end[2], t)})`;
      };

      if (value < 0.25) {
        return lerpColor([29, 78, 216], [6, 182, 212], value / 0.25);
      }
      if (value < 0.5) {
        return lerpColor([6, 182, 212], [16, 185, 129], (value - 0.25) / 0.25);
      }
      if (value < 0.75) {
        return lerpColor([16, 185, 129], [245, 158, 11], (value - 0.5) / 0.25);
      }
      return lerpColor([245, 158, 11], [239, 68, 68], (value - 0.75) / 0.25);
    };

    const getSdaColor = (pointIndex: number, pointValue: number): string => {
      const pass = result.sdaPassMask?.[pointIndex];
      if (pass === true) {
        return 'rgb(16, 185, 129)';
      }
      if (pass === false) {
        return 'rgb(239, 68, 68)';
      }

      const clamped = Math.max(0, Math.min(100, pointValue));
      const t = clamped / 100;
      const mix = (a: number, b: number, tv: number) => Math.round(a + (b - a) * tv);
      return `rgb(${mix(239, 16, t)}, ${mix(68, 185, t)}, ${mix(68, 129, t)})`;
    };

    const cells = visiblePointEntries.map(({ point, index }) => {
      const x = offsetX + (point.x - minX) * scale - cellSizePx / 2;
      const y = offsetY + (maxZ - point.z) * scale - cellSizePx / 2;
      const color = mode === 'df'
        ? getDfColorForNormalizedValue(normalize(point.value))
        : getSdaColor(index, point.value);

      return {
        x,
        y,
        color
      };
    });

    return {
      viewSize,
      cellSizePx,
      minValue,
      maxValue,
      cells
    };
  }, [visiblePointEntries, mode, result.sdaPassMask]);

  const activeLegendStats = useMemo(() => {
    if (visiblePoints.length === 0) {
      return null;
    }

    const values = visiblePoints.map((point) => point.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }, [visiblePoints]);

  if (!isOpen) return null;

  const passingSensors = result.sdaPassMask ? result.sdaPassMask.filter(Boolean).length : 0;
  const passingPercentage = result.sdaPassMask && result.sdaPassMask.length > 0
    ? (passingSensors / result.sdaPassMask.length) * 100
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div>
            <h2 className="text-lg font-semibold text-white">Results Explorer</h2>
            <p className="text-sm text-gray-400 mt-1">{buildingName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMode('df')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'df' ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Sun className="w-4 h-4 inline mr-2" />
              DF Heatmap
            </button>
            <button
              onClick={() => setMode('sda')}
              disabled={!hasSda}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === 'sda' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              } disabled:bg-gray-700/60 disabled:text-gray-500 disabled:cursor-not-allowed`}
            >
              <Activity className="w-4 h-4 inline mr-2" />
              sDA View
            </button>
          </div>

          {mode === 'sda' && hasSda && (
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
              <Filter className="w-4 h-4 text-gray-400" />
              <input
                type="checkbox"
                checked={showPassingOnly}
                onChange={(e) => setShowPassingOnly(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500"
              />
              Show passing sensors only
            </label>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3">
              <div className="text-xs text-gray-400">Sensor Count</div>
              <div className="text-lg font-semibold text-white">{visiblePoints.length}</div>
            </div>
            <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3">
              <div className="text-xs text-gray-400">Mean DF</div>
              <div className="text-lg font-semibold text-cyan-300">{result.meanDF.toFixed(2)}%</div>
            </div>
            <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3">
              <div className="text-xs text-gray-400">DF Range</div>
              <div className="text-sm font-semibold text-white">
                {result.minDF !== undefined ? result.minDF.toFixed(2) : '-'} to {result.maxDF !== undefined ? result.maxDF.toFixed(2) : '-'}
              </div>
            </div>
            <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-3">
              <div className="text-xs text-gray-400">sDA 300/50</div>
              <div className="text-lg font-semibold text-emerald-300">{result.sda.toFixed(1)}%</div>
            </div>
          </div>

          {activeLegendStats && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
              <div className="text-xs text-gray-300 font-medium mb-2">
                Active {mode === 'df' ? 'DF' : 'sDA'} Visualization Legend
              </div>
              <div
                className="h-3 rounded-md border border-gray-700"
                style={{
                  background: mode === 'df'
                    ? 'linear-gradient(90deg, rgb(29,78,216) 0%, rgb(6,182,212) 25%, rgb(16,185,129) 50%, rgb(245,158,11) 75%, rgb(239,68,68) 100%)'
                    : 'linear-gradient(90deg, rgb(239,68,68) 0%, rgb(16,185,129) 100%)'
                }}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>{activeLegendStats.min.toFixed(mode === 'df' ? 2 : 1)}%</span>
                <span>{activeLegendStats.max.toFixed(mode === 'df' ? 2 : 1)}%</span>
              </div>
            </div>
          )}

          {mode === 'df' && planView && (
            <div className="bg-gray-900/70 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-100">Plan View DF Heatmap</h3>
                <div className="text-xs text-gray-400">Top-down projection</div>
              </div>

              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                <svg
                  viewBox={`0 0 ${planView.viewSize} ${planView.viewSize}`}
                  className="w-full max-w-[320px] aspect-square rounded-lg border border-gray-700 bg-gray-950"
                  role="img"
                  aria-label="Plan view daylight factor heatmap"
                >
                  {planView.cells.map((cell, index) => (
                    <rect
                      key={`df-cell-${index}`}
                      x={cell.x}
                      y={cell.y}
                      width={planView.cellSizePx}
                      height={planView.cellSizePx}
                      fill={cell.color}
                      opacity={0.95}
                    />
                  ))}
                </svg>

                <div className="w-full lg:w-48">
                  <div
                    className="h-3 rounded-md border border-gray-700"
                    style={{
                      background: 'linear-gradient(90deg, rgb(29,78,216) 0%, rgb(6,182,212) 25%, rgb(16,185,129) 50%, rgb(245,158,11) 75%, rgb(239,68,68) 100%)'
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{planView.minValue.toFixed(2)}%</span>
                    <span>{planView.maxValue.toFixed(2)}%</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Low DF at left (blue), high DF at right (red).
                  </p>
                </div>
              </div>
            </div>
          )}

          {mode === 'sda' && hasSda && planView && (
            <div className="bg-gray-900/70 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-100">Plan View sDA Map</h3>
                <div className="text-xs text-gray-400">Top-down projection</div>
              </div>

              <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
                <svg
                  viewBox={`0 0 ${planView.viewSize} ${planView.viewSize}`}
                  className="w-full max-w-[320px] aspect-square rounded-lg border border-gray-700 bg-gray-950"
                  role="img"
                  aria-label="Plan view spatial daylight autonomy map"
                >
                  {planView.cells.map((cell, index) => (
                    <rect
                      key={`sda-cell-${index}`}
                      x={cell.x}
                      y={cell.y}
                      width={planView.cellSizePx}
                      height={planView.cellSizePx}
                      fill={cell.color}
                      opacity={0.95}
                    />
                  ))}
                </svg>

                <div className="w-full lg:w-56">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(16, 185, 129)' }} />
                      Passing
                    </div>
                    <div className="flex items-center gap-2 text-gray-300">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(239, 68, 68)' }} />
                      Not passing
                    </div>
                  </div>

                  <div
                    className="mt-3 h-3 rounded-md border border-gray-700"
                    style={{ background: 'linear-gradient(90deg, rgb(239,68,68) 0%, rgb(16,185,129) 100%)' }}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{planView.minValue.toFixed(1)}%</span>
                    <span>{planView.maxValue.toFixed(1)}%</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    sDA sensor values shown as a plan map. Use "Show passing sensors only" to isolate compliant cells.
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasSda && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-3 text-sm text-gray-300">
              Passing sensors: <span className="text-emerald-300 font-semibold">{passingSensors}</span> / {result.sdaPassMask?.length || 0}
              <span className="text-gray-400"> ({passingPercentage.toFixed(1)}%)</span>
            </div>
          )}

          <div className="text-xs text-gray-400">
            Explorer values update live as you switch between DF and sDA modes.
          </div>
        </div>
      </div>
    </div>
  );
};
