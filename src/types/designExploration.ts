import { BuildingData } from './building';
import { DaylightRunSummary } from './daylight';

export interface DesignMetrics {
  heatingDemand: number; // kWh/m²/year
  spatialDaylightAutonomy: number; // percentage
  globalWarmingPotential: number; // kg CO2 eq/m²
}

export type DaylightRunStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface DaylightRunMetadata {
  studyId?: string;
  status: DaylightRunStatus;
  stage?: string;
  error?: string;
  sensorCount?: number;
  meanDF?: number;
  updatedAt: string;
}

export interface DesignNode {
  id: string;
  timestamp: Date;
  name: string;
  buildings: BuildingData[];
  metrics: DesignMetrics;
  daylightRun?: DaylightRunMetadata;
  daylightResultsByBuildingId?: Record<string, DaylightRunSummary>;
  parentId?: string;
  position?: { x: number; y: number }; // For graph layout
}

export interface DesignExplorationGraph {
  nodes: DesignNode[];
  edges: { from: string; to: string }[];
  currentNodeId?: string;
}

export interface GraphPosition {
  x: number;
  y: number;
}
