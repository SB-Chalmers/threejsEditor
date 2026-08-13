import { Point3D, BuildingConfig, BuildingData, DEFAULT_BUILDING_COLOR } from '../types/building';
import { BuildingService } from '../services/BuildingService';
import { ensureCounterClockwise } from './geometry';
import { DEFAULT_FACADE_PARAMETERS } from '../services/FacadeGeometry';
import { calculateBuildingMetrics } from './buildingMetrics';

/**
 * Configuration options for creating a sample building
 */
export interface SampleBuildingConfig {
  centerX?: number;
  centerZ?: number;
  radius?: number;
  width?: number;
  depth?: number;
  floors?: number;
  floorHeight?: number;
  color?: number;
  name?: string;
  description?: string;
  windowToWallRatio?: number;
}

/**
 * Creates a rectangular building footprint centered on the provided origin.
 * Points are generated in anti-clockwise order.
 */
function createRectanglePoints(centerX: number = 0, centerZ: number = 0, width: number = 10, depth: number = 5): Point3D[] {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  return [
    { x: centerX - halfWidth, y: 0, z: centerZ - halfDepth },
    { x: centerX + halfWidth, y: 0, z: centerZ - halfDepth },
    { x: centerX + halfWidth, y: 0, z: centerZ + halfDepth },
    { x: centerX - halfWidth, y: 0, z: centerZ + halfDepth }
  ];
}

/**
 * Calculate polygon area using shoelace formula
 */
/**
 * Creates a simple sample building for startup.
 */
export function addSampleBuilding(
  buildingService: BuildingService,
  _windowService: unknown = null,
  config: SampleBuildingConfig = {}
): BuildingData | null {
  void _windowService;
  try {
    // Default configuration
    const {
      centerX = 0,
      centerZ = 0,
      radius,
      width = 10,
      depth = 5,
      floors = 6,
      floorHeight = 3.5,
      color = DEFAULT_BUILDING_COLOR,
      name = 'Welcome Room',
      description = 'A 10m x 5m starter room building',
      windowToWallRatio = DEFAULT_FACADE_PARAMETERS.wwr
    } = config;

    // Backward compatibility: if radius is provided by legacy callers, convert to a rectangle size.
    const resolvedWidth = radius !== undefined ? radius * 2 : width;
    const resolvedDepth = radius !== undefined ? radius : depth;

    // Create rectangular points and ensure they are in anti-clockwise order
    const points = ensureCounterClockwise(createRectanglePoints(centerX, centerZ, resolvedWidth, resolvedDepth));
    
    // Create building configuration
    const buildingConfig: BuildingConfig = {
      floors,
      floorHeight,
      color,
      name,
      description,
      enableShadows: true,
      window_to_wall_ratio: windowToWallRatio,
      window_overhang: false,
      window_overhang_depth: 0,
      wall_construction: 'Default Wall',
      floor_construction: 'Default Floor',
      roof_construction: 'Default Roof',
      window_construction: 'Default Window',
      structural_system: 'Concrete',
      building_program: 'Office',
      hvac_system: 'VAV',
      natural_ventilation: false
    };

    // Create the building mesh using BuildingService
    const buildingMesh = buildingService.createBuilding(points, buildingConfig);
    
    // Calculate area for building data
    const metrics = calculateBuildingMetrics(points, floors, floorHeight);
    
    // Generate unique building ID
    const buildingId = `debug_building_${Date.now()}`;
    
    // Configure mesh userData for interaction
    buildingMesh.userData = {
      buildingId,
      interactive: true,
      clickable: true,
      type: 'building',
      isBuilding: true,
      isDebug: true,
      name, // Store name in userData
      description // Store description in userData
    };

    // Create building data object
    const building: BuildingData = {
      id: buildingId,
      mesh: buildingMesh,
      points,
      footprintArea: metrics.footprintArea,
      metrics,
      floors,
      floorHeight,
      createdAt: new Date(),
      name,
      description,
      color,
      footprintOutline: null,
      floorLines: null,
      window_to_wall_ratio: windowToWallRatio,
      window_overhang: buildingConfig.window_overhang,
      window_overhang_depth: buildingConfig.window_overhang_depth,
      wall_construction: buildingConfig.wall_construction,
      floor_construction: buildingConfig.floor_construction,
      roof_construction: buildingConfig.roof_construction,
      window_construction: buildingConfig.window_construction,
      structural_system: buildingConfig.structural_system,
      building_program: buildingConfig.building_program,
      hvac_system: buildingConfig.hvac_system,
      natural_ventilation: buildingConfig.natural_ventilation
    };

    console.log('Sample building created:', {
      id: building.id,
      name: building.name,
      center: { x: centerX, z: centerZ },
      width: resolvedWidth,
      depth: resolvedDepth,
      floors,
      grossFloorArea: metrics.grossFloorArea.toFixed(2),
      hasWindows: false
    });

    return building;
    
  } catch (error) {
    console.error('Error creating sample building:', error);
    return null;
  }
}
