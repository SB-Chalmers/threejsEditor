import { describe, expect, it } from 'vitest';
import { getOverlayPointsForResults, getOverlayGroupsForResults } from '../DaylightVisualizationService';
import type { DaylightRunSummary } from '../../types/daylight';

const makeResult = (points: Array<{ x: number; y: number; z: number; value: number }>): DaylightRunSummary => ({
  studyId: 'study',
  status: 'complete',
  sensorCount: points.length,
  meanDF: 10,
  sda: 50,
  points: points.map((point) => ({ ...point })),
  startedAt: '2025-01-01T00:00:00.000Z'
});

describe('getOverlayPointsForResults', () => {
  it('returns all overlay points from every saved result', () => {
    const results = {
      a: makeResult([{ x: 0, y: 0, z: 0, value: 1 }]),
      b: makeResult([{ x: 1, y: 0, z: 1, value: 2 }])
    };

    const overlayPoints = getOverlayPointsForResults(results, 'df');

    expect(overlayPoints).toHaveLength(2);
    expect(overlayPoints.map((point) => point.x)).toEqual([0, 1]);
  });
});

describe('getOverlayGroupsForResults', () => {
  it('returns one group per building so cell sizes can be estimated independently', () => {
    const results = {
      a: makeResult([{ x: 0, y: 0, z: 0, value: 1 }, { x: 1, y: 0, z: 0, value: 2 }]),
      b: makeResult([{ x: 100, y: 0, z: 0, value: 3 }, { x: 101, y: 0, z: 0, value: 4 }])
    };

    const groups = getOverlayGroupsForResults(results, 'df');

    expect(groups).toHaveLength(2);
    // Each group contains only its own building's points
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(2);
    // The two groups are separate — no cross-building mixing
    expect(groups[0].map((p) => p.x)).toEqual([0, 1]);
    expect(groups[1].map((p) => p.x)).toEqual([100, 101]);
  });

  it('returns empty array when no results are present', () => {
    expect(getOverlayGroupsForResults(undefined, 'df')).toEqual([]);
    expect(getOverlayGroupsForResults({}, 'df')).toEqual([]);
  });
});
