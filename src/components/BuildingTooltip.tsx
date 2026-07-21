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
        className="fixed z-50 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-600 p-4 min-w-64 pointer-events-auto"
        style={{
          left: Math.min(Math.max(position.x - 140, 10), window.innerWidth - 280),
          top: Math.max(Math.min(position.y - 120, window.innerHeight - 200), 10),
        }}
      >
        {/* Header */}
        <div className="flex items-center space-x-2 mb-3">
          <div 
            className="w-4 h-4 rounded"
            style={{ backgroundColor: `#${(building.color || getThemeColorAsHex('--color-building-default')).toString(16).padStart(6, '0')}` }}
          />
          <Building className="w-4 h-4 text-gray-400" />
          <span className="text-white font-medium text-sm">
            {building.name || 'Unnamed Building'}
          </span>
        </div>

        {/* Building Info */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total Area:</span>
            <span className="text-green-400 font-medium">{building.area.toFixed(1)} m²</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Floors:</span>
            <span className="text-blue-400 font-medium">{building.floors}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Height:</span>
            <span className="text-purple-400 font-medium">
              {(building.floors * building.floorHeight).toFixed(1)}m
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={`grid gap-2 ${hasDaylightResult ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {hasDaylightResult && (
            <button
              onClick={handleViewResult}
              className="flex items-center justify-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm transition-colors"
            >
              <Eye className="w-3 h-3" />
              <span>View Result</span>
            </button>
          )}
          <button
            onClick={handleEdit}
            className="flex items-center justify-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
          >
            <Edit className="w-3 h-3" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center justify-center space-x-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </>
  );
};
