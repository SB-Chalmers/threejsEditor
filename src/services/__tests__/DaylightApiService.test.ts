import { describe, expect, it } from 'vitest';
import { daylightApiService } from '../DaylightApiService';
import type { BuildingData } from '../../types/building';
import type { DaylightStudyRequest, DaylightStudyResult } from '../../types/daylight';

const makeBuilding = (): BuildingData => ({
  id: 'building-1',
  mesh: {} as BuildingData['mesh'],
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 0, z: 4 },
    { x: 0, y: 0, z: 4 }
  ],
  footprintArea: 16,
  metrics: { footprintArea: 16, grossFloorArea: 32, perimeter: 16, totalHeight: 6 },
  floors: 3,
  floorHeight: 3,
  createdAt: new Date()
});

const validateResultArrays = (result: DaylightStudyResult, request: DaylightStudyRequest) =>
  (daylightApiService as unknown as {
    validateResultArrays: (studyResult: DaylightStudyResult, studyRequest: DaylightStudyRequest) => void;
  }).validateResultArrays(result, request);

describe('DaylightApiService sensor point mapping', () => {
  it('requests a full-quality sensor grid on every building floor', () => {
    const request = daylightApiService.buildRequestFromBuilding(makeBuilding());

    expect(request.quality).toBe('full');
    expect(request.room.floors).toBe(3);
    expect(request.room.simulate_all_floors).toBe(true);
    expect(request.room.sensor_grid).toEqual({ x_dim: 0.5, y_dim: 0.5, offset: 0.75 });
    expect(request.room).toMatchObject({
      wwr: 0.4,
      window_width: 1.2,
      window_height: 1.5,
      window_spacing: 0.3,
      wall_thickness: 0.3,
      additional_horizontal_shading_depth: 0,
      additional_vertical_shading_depth: 0
    });
  });

  it('preserves zero WWR and stored overhang depth while ignoring a disabled addition', () => {
    const building = {
      ...makeBuilding(),
      window_to_wall_ratio: 0,
      window_overhang: false,
      window_overhang_depth: 0.5
    };
    const request = daylightApiService.buildRequestFromBuilding(building);

    expect(request.room.wwr).toBe(0);
    expect(request.room.additional_horizontal_shading_depth).toBe(0);
  });

  it('only uses selected-floor mode when it is explicitly requested', () => {
    const request = daylightApiService.buildRequestFromBuilding(makeBuilding(), {
      selected_floor_number: 2,
      simulate_all_floors: false
    });

    expect(request.room.selected_floor_number).toBe(2);
    expect(request.room.simulate_all_floors).toBe(false);
  });

  it('normalizes a browser-wound footprint to the valid Honeybee XY orientation', () => {
    const building = makeBuilding();
    building.points = [...building.points].reverse();
    const request = daylightApiService.buildRequestFromBuilding(building);
    const signedArea = request.room.footprint_coordinates.reduce((area, point, index, points) => {
      const next = points[(index + 1) % points.length];
      return area + point[0] * next[1] - next[0] * point[1];
    }, 0) / 2;

    expect(signedArea).toBeGreaterThan(0);
  });

  it('builds the direct HBJSON attachment URL', () => {
    expect(daylightApiService.getStudyModelDownloadUrl('study/one')).toBe(
      '/api/daylight/v1/studies/study%2Fone/model.hbjson'
    );
  });

  it('maps Honeybee sensor points directly into Three.js coordinates', () => {
    const points = (daylightApiService as unknown as {
      mapBackendSensorPoints: (sensorPoints: [number, number, number][], values: number[]) => Array<{
        x: number;
        y: number;
        z: number;
        value: number;
      }>;
    }).mapBackendSensorPoints(
      [
        [12, 34, 56],
        [7, 8, 9]
      ],
      [100, 200]
    );

    expect(points).toEqual([
      { x: 12, y: 56, z: 34, value: 100 },
      { x: 7, y: 9, z: 8, value: 200 }
    ]);
  });

  it('throws when sensor points and values do not have equal lengths', () => {
    expect(() =>
      (daylightApiService as unknown as {
        mapBackendSensorPoints: (sensorPoints: [number, number, number][], values: number[]) => unknown;
      }).mapBackendSensorPoints([[1, 2, 3]], [10, 20])
    ).toThrow(/mismatched sensor points/i);
  });

  it('accepts aligned all-floor arrays and contiguous sensor grid ranges', () => {
    const request = daylightApiService.buildRequestFromBuilding(makeBuilding(), { run_sda: true });
    const result: DaylightStudyResult = {
      study_id: 'study-1',
      df: {
        summary: { mean_df: 2.5, min_df: 1, max_df: 4 },
        values: [1, 2, 3, 4]
      },
      sda: {
        summary: { sda_300_50: 50, sensor_count: 4, passing_sensors: 2 },
        values: [10, 20, 80, 90],
        pass: [false, false, true, true]
      },
      sensor_points: [
        [0, 0, 0.75],
        [1, 0, 0.75],
        [0, 0, 3.75],
        [1, 0, 3.75]
      ],
      sensor_grids: [
        {
          identifier: 'floor-1-grid',
          full_identifier: 'room-floor-1-grid',
          room_identifier: 'room-floor-1',
          floor_number: 1,
          start_sensor_index: 0,
          sensor_count: 2
        },
        {
          identifier: 'floor-2-grid',
          full_identifier: 'room-floor-2-grid',
          room_identifier: 'room-floor-2',
          floor_number: 2,
          start_sensor_index: 2,
          sensor_count: 2
        }
      ]
    };

    expect(() => validateResultArrays(result, request)).not.toThrow();
  });

  it('rejects independently truncated sDA pass arrays', () => {
    const request = daylightApiService.buildRequestFromBuilding(makeBuilding(), { run_sda: true });
    const result: DaylightStudyResult = {
      study_id: 'study-1',
      df: {
        summary: { mean_df: 1.5, min_df: 1, max_df: 2 },
        values: [1, 2]
      },
      sda: {
        summary: { sda_300_50: 50, sensor_count: 2, passing_sensors: 1 },
        values: [20, 80],
        pass: [false]
      },
      sensor_points: [[0, 0, 0.75], [1, 0, 0.75]],
      sensor_grids: [{
        identifier: 'floor-1-grid',
        full_identifier: 'room-floor-1-grid',
        room_identifier: 'room-floor-1',
        floor_number: 1,
        start_sensor_index: 0,
        sensor_count: 2
      }]
    };

    expect(() => validateResultArrays(result, request)).toThrow(/misaligned result arrays/i);
  });
});
