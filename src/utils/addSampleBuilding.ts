import { Point3D, BuildingConfig, BuildingData } from '../types/building';
import { BuildingService } from '../services/BuildingService';
import { WindowService } from '../services/WindowService';
import { getThemeColorAsHex } from './themeColors';
import { ensureCounterClockwise } from './geometry';

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
function calculatePolygonArea(points: Point3D[]): number {
  let area = 0;
  const n = points.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].z;
    area -= points[j].x * points[i].z;
  }
  
  return Math.abs(area) / 2;
}

/**
 * Creates a simple sample building for startup.
 */
export function addSampleBuilding(
  buildingService: BuildingService,
  windowService: WindowService | null = null,
  config: SampleBuildingConfig = {}
): BuildingData | null {
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
      color = getThemeColorAsHex('--color-building-sample', 0xFFFFFF),
      name = 'Welcome Room',
      description = 'A 10m x 5m starter room building',
      windowToWallRatio = 0.4
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
      window_overhang_depth: 0.5,
      wall_construction: 'Concrete Block',
      floor_construction: 'Concrete Slab',
      roof_construction: 'Built-up Roof',
      window_construction: 'Double Glazed',
      structural_system: 'Concrete',
      building_program: 'Office',
      hvac_system: 'VAV',
      natural_ventilation: false
    };

    // Create the building mesh using BuildingService
    const buildingMesh = buildingService.createBuilding(points, buildingConfig);
    
    // Calculate area for building data
    const area = calculatePolygonArea(points);
    
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
      area,
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

    // Add windows if window service is available
    if (windowService) {
      const windowConfig = {
        windowWidth: 2.0,
        windowHeight: 1.5,
        windowSpacing: 1.0,
        frameThickness: 0.1,
        offsetDistance: 0.1,
        maxWindows: 50000
      };
      
      windowService.addBuildingWindows(building, windowConfig);
      console.log(`Added windows to sample building: ${building.id}`);
    }

    console.log('Sample building created:', {
      id: building.id,
      name: building.name,
      center: { x: centerX, z: centerZ },
      width: resolvedWidth,
      depth: resolvedDepth,
      floors,
      area: area.toFixed(2),
      hasWindows: !!windowService
    });

    return building;
    
  } catch (error) {
    console.error('Error creating sample building:', error);
    return null;
  }
}
