import { describe, expect, it } from 'vitest';
import type { BuildingData } from '../../types/building';
import type { DaylightRunSummary } from '../../types/daylight';
import { createDaylightInputFingerprint, createEnergyInputFingerprint, retainValidDaylightResults } from '../SimulationFingerprint';

const building = (id: string): BuildingData => ({
  id,
  mesh: {} as BuildingData['mesh'],
  points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 8 }, { x: 0, y: 0, z: 8 }],
  footprintArea: 80,
  metrics: { footprintArea: 80, grossFloorArea: 240, perimeter: 36, totalHeight: 9 },
  floors: 3,
  floorHeight: 3,
  createdAt: new Date(),
  name: 'Original',
  color: 0x111111,
  window_to_wall_ratio: 0.4,
  window_overhang: false,
  window_overhang_depth: 0.5,
  wall_construction: 'Wall A',
  building_program: 'Office',
  hvac_system: 'VAV'
});

describe('simulation input fingerprints', () => {
  it('ignores metadata but expires daylight for facade and context massing changes', () => {
    const target = building('target');
    const context = building('context');
    const original = createDaylightInputFingerprint(target, [target, context]);

    expect(createDaylightInputFingerprint({ ...target, name: 'Renamed', color: 0xffffff }, [target, context])).toBe(original);
    expect(createDaylightInputFingerprint({ ...target, window_to_wall_ratio: 0.5 }, [target, context])).not.toBe(original);
    expect(createDaylightInputFingerprint(target, [target, { ...context, floors: 4 }])).not.toBe(original);
    expect(createDaylightInputFingerprint(target, [target, { ...context, color: 0xffffff }])).toBe(original);
  });

  it('ignores a stored additional depth while disabled and includes relevant energy inputs', () => {
    const original = building('target');
    expect(createDaylightInputFingerprint({ ...original, window_overhang_depth: 1.2 }, [original]))
      .toBe(createDaylightInputFingerprint(original, [original]));
    expect(createEnergyInputFingerprint({ ...original, name: 'Renamed' })).toBe(createEnergyInputFingerprint(original));
    expect(createEnergyInputFingerprint({ ...original, wall_construction: 'Wall B' })).not.toBe(createEnergyInputFingerprint(original));
    expect(createEnergyInputFingerprint({ ...original, natural_ventilation: true })).not.toBe(createEnergyInputFingerprint(original));
  });

  it('retains working results for metadata commits but not relevant commits, without mutating historical data', () => {
    const original = building('target');
    const historicalResult = {
      inputFingerprint: createDaylightInputFingerprint(original, [original]),
      studyId: 'study-1', status: 'complete', sensorCount: 1, meanDF: 2, sda: 50,
      points: [], sensorGrids: [], startedAt: '2026-01-01', completedAt: '2026-01-01'
    } satisfies DaylightRunSummary;
    const historicalNodeResults = { [original.id]: historicalResult };

    expect(retainValidDaylightResults(historicalNodeResults, [{ ...original, name: 'Renamed' }]))
      .toEqual(historicalNodeResults);
    expect(retainValidDaylightResults(historicalNodeResults, [{ ...original, floors: 4 }]))
      .toEqual({});
    expect(historicalNodeResults).toEqual({ [original.id]: historicalResult });
  });
});
