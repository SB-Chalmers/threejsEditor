import { BuildingData } from './building';

export type DaylightStudyStatus = 'queued' | 'running' | 'complete' | 'failed';

export interface SensorGridConfig {
  x_dim: number;
  y_dim: number;
  offset: number;
}

export interface DaylightRunThresholds {
  da_lux: number;
  sda_target_pct: number;
}

export interface DaylightRoomInput {
  footprint_coordinates: [number, number][];
  orientation_offset: number;
  floor_to_floor_height: number;
  selected_floor_number: number;
  wwr?: number;
  wall_thickness: number;
  additional_horizontal_shading_depth: number;
  additional_vertical_shading_depth: number;
  sensor_grid: SensorGridConfig;
}

export interface DaylightStudyRequest {
  room: DaylightRoomInput;
  run_sda: boolean;
  location?: string;
  quality: 'draft' | 'full';
  thresholds: DaylightRunThresholds;
}

export interface DaylightStudyQueued {
  study_id: string;
  status: DaylightStudyStatus;
  sensor_count: number;
  links: {
    status: string;
    result: string;
  };
}

export interface DaylightStudyStatusResponse {
  study_id: string;
  status: DaylightStudyStatus;
  stage?: string;
  error?: string;
}

export interface DaylightDfSummary {
  mean_df: number;
  min_df: number;
  max_df: number;
}

export interface DaylightSdaSummary {
  sda_300_50: number;
  sensor_count: number;
  passing_sensors: number;
}

export interface DaylightStudyResult {
  study_id: string;
  df: {
    summary: DaylightDfSummary;
    values: number[];
  };
  sda?: {
    summary: DaylightSdaSummary;
    values: number[];
    pass: boolean[];
  };
  sensor_points?: [number, number, number][];
}

export interface DaylightApiError {
  error: string;
  message: string;
}

export interface DaylightLocationItem {
  id: string;
  label: string;
}

export interface DaylightLocationsResponse {
  locations: DaylightLocationItem[];
}

export interface DaylightSensorPoint {
  x: number;
  y: number;
  z: number;
  value: number;
}

export interface DaylightRunSummary {
  studyId: string;
  status: DaylightStudyStatus;
  stage?: string;
  sensorCount: number;
  meanDF: number;
  sda: number;
  minDF?: number;
  maxDF?: number;
  points: DaylightSensorPoint[];
  sdaPoints?: DaylightSensorPoint[];
  sdaPassMask?: boolean[];
  startedAt: string;
  completedAt?: string;
}

export interface DaylightRunState {
  status: DaylightStudyStatus;
  studyId?: string;
  stage?: string;
  error?: string;
}

export interface DaylightBuildRequestOptions {
  run_sda?: boolean;
  location?: string;
  quality?: 'draft' | 'full';
  thresholds?: DaylightRunThresholds;
  sensor_grid?: Partial<SensorGridConfig>;
  selected_floor_number?: number;
}

export interface DaylightRunOptions {
  signal?: AbortSignal;
  pollMs?: number;
  onStatus?: (status: DaylightRunState) => void;
}

export interface DaylightBuildingSelection {
  building: BuildingData;
  selectedFloor: number;
}
