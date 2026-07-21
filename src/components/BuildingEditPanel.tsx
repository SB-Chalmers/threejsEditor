import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as THREE from 'three';
import { X, RotateCcw, Layers, ChevronDown, Home, Wrench, Users, Wind, Info, Check } from 'lucide-react';
import { BuildingData, BuildingConfig } from '../types/building';
import { Tooltip } from './ui/Tooltip';
import { MaterialCompareDialog } from './dialogs/MaterialCompareDialog';
import { getThemeColorAsHex, addThemeChangeListener } from '../utils/themeColors';

const getColorOptions = () => [
  { name: 'Blue', value: getThemeColorAsHex('--color-building-blue', 0x3b82f6) },
  { name: 'Green', value: getThemeColorAsHex('--color-building-green', 0x10b981) },
  { name: 'Purple', value: getThemeColorAsHex('--color-building-purple', 0x8b5cf6) },
  { name: 'Orange', value: getThemeColorAsHex('--color-building-orange', 0xf59e0b) },
  { name: 'Red', value: getThemeColorAsHex('--color-building-red', 0xef4444) },
  { name: 'Cyan', value: getThemeColorAsHex('--color-building-cyan', 0x06b6d4) },
  { name: 'Pink', value: getThemeColorAsHex('--color-building-pink', 0xec4899) },
  { name: 'Gray', value: getThemeColorAsHex('--color-building-gray', 0x6b7280) }
];

// Updated options with performance data
const wallOptions = [
  { label: "Default Wall – U: 1.6 W/m²K, CO₂: 60 kg/m²", value: "Default Wall" },
  { label: "Concrete – U: 1.8 W/m²K, CO₂: 80 kg/m²", value: "Concrete" },
  { label: "Brick – U: 1.2 W/m²K, CO₂: 90 kg/m²", value: "Brick" },
  { label: "Wood – U: 0.35 W/m²K, CO₂: 45 kg/m²", value: "Wood" },
  { label: "Steel – U: 2.0 W/m²K, CO₂: 120 kg/m²", value: "Steel" }
];
const floorOptions = [
  { label: "Default Floor – U: 1.5 W/m²K", value: "Default Floor" },
  { label: "Concrete Slab – U: 1.8 W/m²K", value: "Concrete Slab" },
  { label: "Raised Floor – U: 1.2 W/m²K", value: "Raised Floor" }
];
const roofOptions = [
  { label: "Default Roof – U: 1.4 W/m²K", value: "Default Roof" },
  { label: "Flat Roof – U: 1.6 W/m²K", value: "Flat Roof" },
  { label: "Pitched Roof – U: 1.1 W/m²K", value: "Pitched Roof" }
];
const windowOptions = [
  { label: "Default Window – U: 2.8 W/m²K", value: "Default Window" },
  { label: "Double Glazed – U: 1.6 W/m²K", value: "Double Glazed" },
  { label: "Triple Glazed – U: 0.9 W/m²K", value: "Triple Glazed" }
];
const programOptions = [
  'Office', 'Residential', 'Retail', 'School', 'Hospital'
];
const hvacOptions = [
  'Default HVAC', 'VAV', 'CAV', 'Radiant', 'Split System'
];
const structuralOptions = [
  { label: "Concrete – High strength, high embodied carbon", value: "Concrete" },
  { label: "Timber – Sustainable, lower carbon footprint", value: "Timber" },
  { label: "Masonry – Durable, good thermal mass", value: "Masonry" }
];

const createEditedStateFromBuilding = (building: BuildingData): BuildingConfig & { name: string; description: string } => ({
  name: building.name || '',
  description: building.description || '',
  floors: building.floors,
  floorHeight: building.floorHeight,
  color: building.color || getThemeColorAsHex('--color-building-blue', 0x3b82f6),
  window_to_wall_ratio: building.window_to_wall_ratio ?? 0.4,
  window_overhang: building.window_overhang ?? false,
  window_overhang_depth: building.window_overhang_depth ?? 0.0,
  wall_construction: building.wall_construction || 'Default Wall',
  floor_construction: building.floor_construction || 'Default Floor',
  roof_construction: building.roof_construction || 'Default Roof',
  window_construction: building.window_construction || 'Default Window',
  structural_system: building.structural_system || 'Concrete',
  building_program: building.building_program || 'Office',
  hvac_system: building.hvac_system || 'Default HVAC',
  natural_ventilation: building.natural_ventilation ?? false
});

interface BuildingEditPanelProps {
  building: BuildingData;
  onClose: () => void;
  onPreview?: (updates: Partial<BuildingData> & { config?: BuildingConfig }) => void;
  enableBuildingFocus?: (buildingId: string) => void;
  disableBuildingFocus?: () => void;
}

export const BuildingEditPanel: React.FC<BuildingEditPanelProps> = ({
  building,
  onClose,
  onPreview,
  enableBuildingFocus,
  disableBuildingFocus
}) => {  // Collapsible state
  const [sections, setSections] = useState({
    general: true,
    form: false,
    construction: false,
    structural: false,
    program: false,
    hvac: false
  });

  
  // All editable fields
  const [edited, setEdited] = useState<BuildingConfig & { name: string; description: string }>(
    () => createEditedStateFromBuilding(building)
  );

  const initialEditedRef = useRef<BuildingConfig & { name: string; description: string }>(
    createEditedStateFromBuilding(building)
  );
  const [themeVersion, setThemeVersion] = useState(0);
  const previewTimeoutRef = useRef<number | null>(null);

  // Enable focus effect when panel opens
  useEffect(() => {
    if (enableBuildingFocus && building.id) {
      enableBuildingFocus(building.id);
      console.log('Building focus enabled for:', building.id);
    }
    
    // Cleanup focus effect when panel unmounts
    return () => {
      if (disableBuildingFocus) {
        disableBuildingFocus();
        console.log('Building focus disabled on unmount');
      }
    };
  }, [building.id, enableBuildingFocus, disableBuildingFocus]);

  useEffect(() => {
    // Listen for theme changes to refresh colors
    const cleanup = addThemeChangeListener(() => {
      setThemeVersion(prev => prev + 1);
    });
    
    return cleanup;
  }, []);

  const hasChanges = JSON.stringify(edited) !== JSON.stringify(initialEditedRef.current);

  const buildUpdatesFromEdited = useCallback((nextEdited: BuildingConfig & { name: string; description: string }) => ({
    name: nextEdited.name,
    description: nextEdited.description,
    floors: nextEdited.floors,
    floorHeight: nextEdited.floorHeight,
    color: nextEdited.color,
    window_to_wall_ratio: nextEdited.window_to_wall_ratio,
    window_overhang: nextEdited.window_overhang,
    window_overhang_depth: nextEdited.window_overhang_depth,
    wall_construction: nextEdited.wall_construction,
    floor_construction: nextEdited.floor_construction,
    roof_construction: nextEdited.roof_construction,
    window_construction: nextEdited.window_construction,
    structural_system: nextEdited.structural_system,
    building_program: nextEdited.building_program,
    hvac_system: nextEdited.hvac_system,
    natural_ventilation: nextEdited.natural_ventilation,
    config: { ...nextEdited }
  }), []);

  const updateField = (field: keyof typeof edited, value: any) => {
    setEdited((prev) => {
      const updatedEdited = { ...prev, [field]: value };

      if (
        field === 'color' &&
        building.mesh &&
        building.mesh.material &&
        building.mesh.userData.buildingId &&
        !building.mesh.userData.isPreview &&
        !building.mesh.userData.isDrawingElement
      ) {
        const material = building.mesh.material as THREE.MeshLambertMaterial;
        material.color.setHex(value);
      }

      debouncedWindowUpdate(buildUpdatesFromEdited(updatedEdited));
      return updatedEdited;
    });
  };

  const cancelPendingPreviewUpdate = useCallback(() => {
    if (previewTimeoutRef.current !== null) {
      window.clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
  }, []);

  const handleReset = () => {
    cancelPendingPreviewUpdate();
    const resetEdited = { ...initialEditedRef.current };
    setEdited(resetEdited);
    if (onPreview) {
      onPreview(buildUpdatesFromEdited(resetEdited));
    }
  };

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };
  // State for comparison modal
  const [compareModal, setCompareModal] = useState<{
    open: boolean;
    type: 'wall' | 'floor' | 'roof' | 'window' | 'structural';
    currentValue: string;
  } | null>(null);

  // Stub for compare modal (not implemented)
  const openCompareModal = (field: string) => {
    let type: 'wall' | 'floor' | 'roof' | 'window' | 'structural' = 'wall';
    let currentValue = '';
    
    // Set the correct type and value based on field
    switch(field) {
      case 'wall':
        type = 'wall';
        currentValue = edited.wall_construction || 'Default Wall';
        break;
      case 'floor':
        type = 'floor';
        currentValue = edited.floor_construction || 'Default Floor';
        break;
      case 'roof':
        type = 'roof';
        currentValue = edited.roof_construction || 'Default Roof';
        break;
      case 'window':
        type = 'window';
        currentValue = edited.window_construction || 'Default Window';
        break;
      case 'structural':
        type = 'structural';
        currentValue = edited.structural_system || 'Concrete';
        break;
    }
    
    setCompareModal({
      open: true,
      type,
      currentValue
    });
  };

  // Restore original geometry when panel is closed without saving
  const handleClose = useCallback(() => {
    cancelPendingPreviewUpdate();

    // Disable focus effect before closing
    if (disableBuildingFocus) {
      disableBuildingFocus();
      console.log('Building focus disabled on close');
    }

    // Call the original onClose handler
    onClose();
  }, [onClose, disableBuildingFocus, cancelPendingPreviewUpdate]);

  useEffect(() => {
    return () => {
      cancelPendingPreviewUpdate();
    };
  }, [cancelPendingPreviewUpdate]);

  // Debounced window update to avoid too many rapid updates
  const debouncedWindowUpdate = useCallback((updates: Partial<BuildingData> & { config: BuildingConfig }) => {
    cancelPendingPreviewUpdate();

    previewTimeoutRef.current = window.setTimeout(() => {
      // Always use onPreview for live updates to keep dialog open
      if (onPreview) {
        onPreview(updates);
      } else {
        // If no onPreview is available, still use onSave but ensure dialog stays open
        // by not including closing logic
        console.warn('No onPreview handler provided for live updates');
      }
      previewTimeoutRef.current = null;
    }, 50); // Fast debounce for very responsive updates
  }, [onPreview, cancelPendingPreviewUpdate]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Simplified backdrop - Three.js handles the selective focus */}
      <div className="fixed inset-0 bg-black/20 pointer-events-auto" onClick={handleClose} />
      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-gray-900/98 shadow-2xl border-l border-gray-700/50 z-50 flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50 bg-gray-800/50">
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Building</h2>
            <p className="text-sm text-gray-400 mt-1">{building.name || 'Unnamed Building'}</p>
          </div>
          <button 
            onClick={handleClose} 
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* GENERAL */}
          <Section 
            title="General" 
            icon={<Info className="w-4 h-4" />}
            open={sections.general} 
            onToggle={() => toggleSection('general')}
          >
            <div className="space-y-4">
              <div>                <div className="flex items-center mb-2">
                  <label className="block text-xs font-medium text-gray-400">
                    Building Name
                  </label>
                  <Tooltip content="A descriptive name for your building.">
                    <span className="ml-2 text-blue-400 cursor-pointer">
                      <Info className="w-3 h-3" />
                    </span>
                  </Tooltip>
                </div>
                <input
                  type="text"
                  value={edited.name}
                  onChange={e => updateField('name', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition-colors"
                  placeholder="Enter building name"
                />
              </div>

              <div>                <div className="flex items-center mb-2">
                  <label className="block text-xs font-medium text-gray-400">
                    Description
                  </label>
                  <Tooltip content="Describe the building's purpose, location, or any notes for simulation.">
                    <span className="ml-2 text-blue-400 cursor-pointer">
                      <Info className="w-3 h-3" />
                    </span>
                  </Tooltip>
                </div>
                <textarea
                  value={edited.description}
                  onChange={e => updateField('description', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition-colors resize-none"
                  placeholder="Building description..."
                  rows={3}
                />
              </div>
            </div>
          </Section>

          {/* FORM & MASSING */}
          <Section 
            title="Form & Massing" 
            icon={<Layers className="w-4 h-4" />}
            open={sections.form} 
            onToggle={() => toggleSection('form')}
          >
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-gray-400">
                      Number of Floors
                    </label>
                    <Tooltip content="More floors increase usable area but also surface area for heat loss/gain.">
                      <span className="ml-2 text-blue-400 cursor-pointer">
                        <Info className="w-3 h-3" />
                      </span>
                    </Tooltip>
                  </div>
                  <span className="text-sm font-semibold text-white bg-gray-700 px-2 py-1 rounded">
                    {edited.floors}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={edited.floors}
                  onChange={e => updateField('floors', parseInt(e.target.value))}
                  className="w-full h-2 rounded bg-gray-700 accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1</span>
                  <span>50</span>
                </div>
                {edited.floors > 30 && (
                  <div className="flex items-center mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <span className="text-yellow-400 mr-2">⚠️</span>
                    <p className="text-xs text-yellow-400">Tall buildings may have higher energy use for elevators and HVAC.</p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-gray-400">
                      Floor Height
                    </label>
                    <Tooltip content="Average height per floor. Higher floors increase volume. Typical: 3–4m.">
                      <span className="ml-2 text-blue-400 cursor-pointer">
                        <Info className="w-3 h-3" />
                      </span>
                    </Tooltip>
                  </div>
                  <span className="text-sm font-semibold text-white bg-gray-700 px-2 py-1 rounded">
                    {edited.floorHeight}m
                  </span>
                </div>
                <input
                  type="range"
                  min="2.5"
                  max="6"
                  step="0.1"
                  value={edited.floorHeight}
                  onChange={e => updateField('floorHeight', parseFloat(e.target.value))}
                  className="w-full h-2 rounded bg-gray-700 accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>2.5m</span>
                  <span>6.0m</span>
                </div>
                {edited.floorHeight > 4.5 && (
                  <div className="flex items-center mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <span className="text-yellow-400 mr-2">⚠️</span>
                    <p className="text-xs text-yellow-400">High floor heights increase heating/cooling volume.</p>
                  </div>
                )}
              </div>



              <div>
                <div className="flex items-center justify-between mb-2">                  <div className="flex items-center">
                    <label className="block text-xs font-medium text-gray-400">
                      Window-to-Wall Ratio
                    </label>
                    <Tooltip content="Higher WWR increases daylight but also heat loss/gain. Typical: 30–60%.">
                      <span className="ml-2 text-blue-400 cursor-pointer">
                        <Info className="w-3 h-3" />
                      </span>
                    </Tooltip>
                  </div><span className="text-sm font-semibold text-white bg-gray-700 px-2 py-1 rounded">
                    {Math.round((edited.window_to_wall_ratio ?? 0.4) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={edited.window_to_wall_ratio}
                  onChange={e => updateField('window_to_wall_ratio', parseFloat(e.target.value))}
                  className="w-full h-2 rounded bg-gray-700 accent-blue-500 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
                {(edited.window_to_wall_ratio ?? 0.4) > 0.6 && (
                  <div className="flex items-center mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <span className="text-yellow-400 mr-2">⚠️</span>
                    <p className="text-xs text-yellow-400">High WWR may increase cooling load and glare.</p>
                  </div>
                )}
                {(edited.window_to_wall_ratio ?? 0.4) < 0.2 && (
                  <div className="flex items-center mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <span className="text-yellow-400 mr-2">⚠️</span>
                    <p className="text-xs text-yellow-400">Low WWR may reduce daylight and occupant comfort.</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={!!edited.window_overhang}
                    onChange={e => updateField('window_overhang', e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                    id="window_overhang"
                  />                  <label htmlFor="window_overhang" className="flex items-center text-sm text-gray-300">
                    Window Overhang
                    <Tooltip content="Overhangs shade windows, reducing summer heat gain.">
                      <span className="ml-2 text-blue-400 cursor-pointer">
                        <Info className="w-3 h-3" />
                      </span>
                    </Tooltip>
                  </label>
                </div>

                {edited.window_overhang && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-400">
                        Overhang Depth: {(edited.window_overhang_depth ?? 0.0).toFixed(2)}m
                      </label>
                      <Tooltip content="Depth of window overhang. Typical: 0.3–1.2m.">
                        <span className="ml-2 text-blue-400 cursor-pointer">
                          <Info className="w-3 h-3" />
                        </span>
                      </Tooltip>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={edited.window_overhang_depth ?? 0.0}
                      onChange={e => updateField('window_overhang_depth', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>0m</span>
                      <span>1m</span>
                      <span>2m</span>
                    </div>
                    {(edited.window_overhang_depth ?? 0.0) > 1.2 && (
                      <div className="flex items-center mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <span className="text-yellow-400 mr-2">⚠️</span>
                        <p className="text-xs text-yellow-400">Very deep overhangs may block winter sunlight.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
                            <div>                <div className="flex items-center mb-2">
                  <label className="block text-xs font-medium text-gray-400">
                    Building Color
                  </label>
                  <Tooltip content="Affects solar absorption. Darker colors may increase cooling loads.">
                    <span className="ml-2 text-blue-400 cursor-pointer">
                      <Info className="w-3 h-3" />
                    </span>
                  </Tooltip>
                </div>                <div className="grid grid-cols-4 gap-2">
                  {getColorOptions().map(color => (
                    <button
                      key={`${color.value}-${themeVersion}`}
                      onClick={() => updateField('color', color.value)}
                      className={`w-full h-10 rounded-lg border-2 transition-all duration-200 ${
                        edited.color === color.value 
                          ? 'border-white scale-105 shadow-lg' 
                          : 'border-gray-600 hover:border-gray-400 hover:scale-102'
                      }`}
                      style={{ backgroundColor: `#${color.value.toString(16).padStart(6, '0')}` }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>
            
          </Section>

          {/* ENVELOPE & MATERIALS */}
          <Section 
            title="Envelope & Materials" 
            icon={<Home className="w-4 h-4" />}
            open={sections.construction} 
            onToggle={() => toggleSection('construction')}
          >
            <div className="space-y-4">
              {[
                { key: 'wall_construction', label: 'Wall Construction', options: wallOptions, tooltip: 'Wall type affects insulation (U-value) and embodied carbon. Lower U = better insulation.' },
                { key: 'floor_construction', label: 'Floor Construction', options: floorOptions, tooltip: 'Floor insulation affects heat loss to ground or unheated spaces.' },
                { key: 'roof_construction', label: 'Roof Construction', options: roofOptions, tooltip: 'Roof insulation is critical for heat loss/gain. Lower U = better.' },
                { key: 'window_construction', label: 'Window Construction', options: windowOptions, tooltip: 'Window type affects insulation and daylight. Lower U = better insulation.' }
              ].map(({ key, label, options, tooltip }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">                    <div className="flex items-center">
                      <label className="block text-xs font-medium text-gray-400">
                        {label}
                      </label>
                      <Tooltip content={tooltip}>
                        <span className="ml-2 text-blue-400 cursor-pointer">
                          <Info className="w-3 h-3" />
                        </span>
                      </Tooltip>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
                      onClick={() => openCompareModal(key)}
                    >
                      Compare
                    </button>
                  </div>
                  <select
                    value={edited[key as keyof typeof edited] as string}
                    onChange={e => updateField(key as keyof typeof edited, e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition-colors"
                  >
                    {options.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Section>

          {/* USE & OCCUPANCY */}
          <Section 
            title="Use & Occupancy" 
            icon={<Users className="w-4 h-4" />}
            open={sections.program} 
            onToggle={() => toggleSection('program')}
          >
            <div>
              <div className="flex items-center mb-2">                <label className="block text-xs font-medium text-gray-400">
                  Building Program
                </label>
                <Tooltip content="The main use of the building. Affects internal heat gains, schedules, and ventilation needs.">
                  <span className="ml-2 text-blue-400 cursor-pointer">
                    <Info className="w-3 h-3" />
                  </span>
                </Tooltip>
              </div>
              <select
                value={edited.building_program}
                onChange={e => updateField('building_program', e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition-colors"
              >
                {programOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </Section>

          {/* SYSTEMS & VENTILATION */}
          <Section 
            title="Systems & Ventilation" 
            icon={<Wind className="w-4 h-4" />}
            open={sections.hvac} 
            onToggle={() => toggleSection('hvac')}
          >
            <div className="space-y-4">
              <div>
                <div className="flex items-center mb-2">                  <label className="block text-xs font-medium text-gray-400">
                    HVAC System
                  </label>
                  <Tooltip content="Heating, ventilation, and air conditioning type. Impacts energy use and comfort.">
                    <span className="ml-2 text-blue-400 cursor-pointer">
                      <Info className="w-3 h-3" />
                    </span>
                  </Tooltip>
                </div>
                <select
                  value={edited.hvac_system}
                  onChange={e => updateField('hvac_system', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition-colors"
                >
                  {hvacOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={!!edited.natural_ventilation}
                  onChange={e => updateField('natural_ventilation', e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                  id="natural_ventilation"
                />                  <label htmlFor="natural_ventilation" className="flex items-center text-sm text-gray-300">
                  Natural Ventilation
                  <Tooltip content="Allows fresh air through operable windows. Can reduce cooling needs.">
                    <span className="ml-2 text-blue-400 cursor-pointer">
                      <Info className="w-3 h-3" />
                    </span>
                  </Tooltip>
                </label>
              </div>
            </div>
          </Section>

          {/* STRUCTURAL SYSTEM */}
          <Section 
            title="Structural System" 
            icon={<Wrench className="w-4 h-4" />}
            open={sections.structural} 
            onToggle={() => toggleSection('structural')}
          >
            <div className="space-y-4">
              <div>
                <div className="flex items-center mb-2">                  <label className="block text-xs font-medium text-gray-400">
                    Primary Structure
                  </label>
                  <Tooltip content="The main load-bearing system of the building. Affects embodied carbon, construction time, and spans possible.">
                    <span className="ml-2 text-blue-400 cursor-pointer">
                      <Info className="w-3 h-3" />
                    </span>
                  </Tooltip>
                </div>
                <div className="relative">
                  <select
                    value={edited.structural_system}
                    onChange={e => updateField('structural_system', e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent hover:border-gray-400 transition-colors"
                  >
                    {structuralOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>                  <Tooltip content="Compare options">
                    <button 
                      onClick={() => openCompareModal('structural')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700/50 bg-gray-800/30">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center space-x-2 px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-gray-700/50"
            title="Reset to default values"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium">Reset</span>
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-medium text-sm shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>Done</span>
            </button>
          </div>
        </div>

        {/* Material Comparison Dialog */}
        {compareModal && compareModal.open && (
          <MaterialCompareDialog
            title={`Compare ${compareModal.type.charAt(0).toUpperCase() + compareModal.type.slice(1)} Options`}
            options={
              compareModal.type === 'wall' ? wallOptions :
              compareModal.type === 'floor' ? floorOptions :
              compareModal.type === 'roof' ? roofOptions :
              compareModal.type === 'window' ? windowOptions :
              compareModal.type === 'structural' ? structuralOptions.map(opt => ({ ...opt })) : 
              []
            }
            currentValue={compareModal.currentValue}
            onClose={() => setCompareModal(prev => prev ? { ...prev, open: false } : null)}
            onSelect={(value) => {
              updateField(
                compareModal.type === 'wall' ? 'wall_construction' :
                compareModal.type === 'floor' ? 'floor_construction' :
                compareModal.type === 'roof' ? 'roof_construction' :
                compareModal.type === 'window' ? 'window_construction' :
                compareModal.type === 'structural' ? 'structural_system' : 
                'wall_construction',
                value
              );
              setCompareModal(prev => prev ? { ...prev, open: false } : null);
            }}
            type={compareModal.type}
          />
        )}
      </div>
    </div>
  );
};

// Collapsible section helper
const Section: React.FC<{ 
  title: string; 
  icon: React.ReactNode;
  open: boolean; 
  onToggle: () => void; 
  children: React.ReactNode 
}> = ({ title, icon, open, onToggle, children }) => (
  <div className="bg-gray-900/50 rounded-lg shadow-md shadow-black/20 overflow-hidden">
    <button
      type="button"
      className="flex items-center w-full text-left p-4 hover:bg-gray-800/50 transition-colors duration-200 focus:outline-none focus:bg-gray-800/50"
      onClick={onToggle}
    >
      <div className="flex items-center flex-1">
        <div className="text-blue-400 mr-3">
          {icon}
        </div>
        <h3 className="text-sm font-semibold uppercase text-white tracking-wide">
          {title}
        </h3>
      </div>
      <div className="text-gray-400 transition-transform duration-200" style={{transform: open ? 'rotate(180deg)' : 'rotate(0deg)'}}>
        <ChevronDown className="w-4 h-4" />
      </div>
    </button>
    {open && (
      <div className="p-4 pt-0 transition-all duration-200">
        {children}
      </div>
    )}
  </div>
);