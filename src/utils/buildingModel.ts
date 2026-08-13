import { DEFAULT_BUILDING_COLOR, type BuildingConfig, type BuildingModel } from '../types/building';
import { calculateBuildingMetrics } from './buildingMetrics';

export const cloneBuildingModel = (building: BuildingModel): BuildingModel => {
  const points = building.points.map(point => ({ ...point }));
  const metrics = calculateBuildingMetrics(points, building.floors, building.floorHeight);

  return {
    id: building.id,
    points,
    footprintArea: metrics.footprintArea,
    area: building.area,
    metrics,
    floors: building.floors,
    floorHeight: building.floorHeight,
    createdAt: new Date(building.createdAt),
    name: building.name,
    description: building.description,
    color: building.color,
    window_to_wall_ratio: building.window_to_wall_ratio,
    window_overhang: building.window_overhang,
    window_overhang_depth: building.window_overhang_depth,
    wall_construction: building.wall_construction,
    floor_construction: building.floor_construction,
    roof_construction: building.roof_construction,
    window_construction: building.window_construction,
    structural_system: building.structural_system,
    building_program: building.building_program,
    hvac_system: building.hvac_system,
    natural_ventilation: building.natural_ventilation,
  };
};

export const cloneBuildingModels = (buildings: readonly BuildingModel[]): BuildingModel[] =>
  buildings.map(cloneBuildingModel);

export const buildingConfigFromModel = (building: BuildingModel): BuildingConfig => ({
  floors: building.floors,
  floorHeight: building.floorHeight,
  color: building.color ?? DEFAULT_BUILDING_COLOR,
  name: building.name,
  description: building.description,
  window_to_wall_ratio: building.window_to_wall_ratio,
  window_overhang: building.window_overhang,
  window_overhang_depth: building.window_overhang_depth,
  wall_construction: building.wall_construction,
  floor_construction: building.floor_construction,
  roof_construction: building.roof_construction,
  window_construction: building.window_construction,
  structural_system: building.structural_system,
  building_program: building.building_program,
  hvac_system: building.hvac_system,
  natural_ventilation: building.natural_ventilation,
});