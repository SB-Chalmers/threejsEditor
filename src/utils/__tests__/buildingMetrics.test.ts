import { describe, expect, it } from 'vitest';
import { calculateBuildingMetrics, validateFootprint } from '../buildingMetrics';

const point = (x: number, z: number) => ({ x, y: 0, z });

describe('building metrics', () => {
  it.each([
    ['counter-clockwise', [point(0, 0), point(10, 0), point(10, 8), point(0, 8)]],
    ['clockwise', [point(0, 8), point(10, 8), point(10, 0), point(0, 0)]],
  ])('reports GFA independently of %s winding', (_name, points) => {
    expect(calculateBuildingMetrics(points, 4, 3)).toEqual({ footprintArea: 80, grossFloorArea: 320, perimeter: 36, totalHeight: 12 });
  });

  it('reports irregular footprint metrics and rejects invalid edits', () => {
    const irregular = [point(0, 0), point(6, 0), point(6, 2), point(3, 5), point(0, 2)];
    expect(calculateBuildingMetrics(irregular, 3, 3.2).grossFloorArea).toBe(63);
    expect(validateFootprint(irregular)).toBeNull();
    expect(validateFootprint([point(0, 0), point(4, 4), point(0, 4), point(4, 0)])).toMatch(/cross/i);
    expect(validateFootprint([point(0, 0), point(0, 0), point(1, 0)])).toMatch(/overlap/i);
  });
});
