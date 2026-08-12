import React from 'react';
import { Edit, Trash2, Building, Eye } from 'lucide-react';
import { BuildingData } from '../types/building';
import { getThemeColorAsHex } from '../utils/themeColors';

interface BuildingTooltipProps {
  building: BuildingData;
  position: { x: number; y: number };
  onEdit: (building: BuildingData) => void;
  onDelete: (buildingId: string) => void;
  onViewResult?: (building: BuildingData) => void;
  hasDaylightResult?: boolean;
  onClose: () => void;
}

export const BuildingTooltip: React.FC<BuildingTooltipProps> = ({
  building,
  position,
  onEdit,
  onDelete,
  onViewResult,
  hasDaylightResult = false,
  onClose
}) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(building);
    onClose();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${building.name || 'Unnamed Building'}"?`)) {
      onDelete(building.id);
      onClose();
    }
  };

  const handleViewResult = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewResult?.(building);
    onClose();
  };

  return (
    <>
      {/* Invisible backdrop to close tooltip */}
      <div 
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Tooltip */}
      <div
        className="fixed z-50 min-w-64 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl pointer-events-auto"
        style={{
          left: Math.min(Math.max(position.x - 140, 10), window.innerWidth - 280),
          top: Math.max(Math.min(position.y - 120, window.innerHeight - 200), 10),
        }}
      >
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded"
            style={{ backgroundColor: `#${(building.color || getThemeColorAsHex('--color-building-default')).toString(16).padStart(6, '0')}` }}
          />
          <Building className="w-4 h-4 text-slate-400" />
          <span className="text-[12px] font-semibold text-slate-900">
            {building.name || 'Unnamed Building'}
          </span>
        </div>

        {/* Building Info */}
        <div className="mb-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600">GFA</span>
            <span className="font-semibold text-slate-900">{building.metrics.grossFloorArea.toFixed(1)} m²</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600">Floors</span>
            <span className="font-semibold text-slate-900">{building.floors}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600">Height</span>
            <span className="font-semibold text-slate-900">
              {(building.floors * building.floorHeight).toFixed(1)} m
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`grid gap-2 ${hasDaylightResult ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {hasDaylightResult && (
            <button
              onClick={handleViewResult}
              className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View Result</span>
            </button>
          )}
          <button
            onClick={handleEdit}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-blue-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Edit className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-rose-600 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </>
  );
};
