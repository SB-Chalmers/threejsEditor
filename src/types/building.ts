import { ensureCounterClockwise } from '../utils/geometry';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface BuildingConfig {
  floors: number;
  floorHeight: number;
  color: number;
  height?: number; // Computed property for BuildingService
  enableShadows?: boolean; // Optional property to enable/disable shadows
  name?: string; // Add this line
  description?: string; // Add this line

  // Form properties
  window_to_wall_ratio?: number; // Clamped to 0.0–0.95
  window_overhang?: boolean; // Enables additional horizontal overhang depth
  window_overhang_depth?: number; // Stored additional depth; ignored while disabled

  // Construction properties
  wall_construction?: string; // From pre-selected dropdown
  floor_construction?: string; // From pre-selected dropdown
  roof_construction?: string; // From pre-selected dropdown
  window_construction?: string; // From pre-selected dropdown
  
  // Structural system
  structural_system?: string; // Concrete, Timber, Masonry

  // Program properties
  building_program?: string; // From pre-selected dropdown

  // HVAC properties
  hvac_system?: string; // From pre-selected dropdown
  natural_ventilation?: boolean; // True/false
}

export interface BuildingMetrics {
  footprintArea: number;
  grossFloorArea: number;
  perimeter: number;
  totalHeight: number;
}

export interface DrawingState {
  isDrawing: boolean;
  points: Point3D[];
  markers: THREE.Mesh[];
  lines: (THREE.Line | Line2)[];
  lengthLabels: THREE.Sprite[];
  previewMarker: THREE.Mesh | null;
  previewLine: (THREE.Line | Line2) | null;
  previewBuilding: THREE.Mesh | null;
  previewLengthLabel: THREE.Sprite | null;
  snapToStart: boolean;
}

/** Pure building state used by the workspace, simulations, and graph snapshots. */
export interface BuildingModel {
  id: string;
  points: Point3D[];
  /** Canonical plan area. Derived from `points`; never trusted from imports. */
  footprintArea: number;
  /** @deprecated Legacy import compatibility only. Use `footprintArea`. */
  area?: number;
  metrics: BuildingMetrics;
  floors: number;
  floorHeight: number;
  createdAt: Date;
  name?: string;
  description?: string;
  color?: number;

  // Form properties
  window_to_wall_ratio?: number;
  window_overhang?: boolean;
  window_overhang_depth?: number;

  // Construction properties
  wall_construction?: string;
  floor_construction?: string;
  roof_construction?: string;
  window_construction?: string;
  
  // Structural system
  structural_system?: string;

  // Program properties
  building_program?: string;

  // HVAC properties
  hvac_system?: string;
  natural_ventilation?: boolean;
}

/** Runtime projection of a BuildingModel into the Three.js scene. */
export interface BuildingData extends BuildingModel {
  mesh: THREE.Mesh;
  footprintOutline?: THREE.Mesh | null;
  floorLines?: THREE.Group | null;
}

export interface BuildingTooltipData {
  building: BuildingData;
  position: { x: number; y: number };
  visible: boolean;
}

/**
 * Utility function to normalize building points to ensure they are in anti-clockwise order
 */
export const normalizeBuildingPoints = (points: Point3D[]): Point3D[] => {
  return ensureCounterClockwise(points);
};
