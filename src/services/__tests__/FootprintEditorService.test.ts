import { describe, expect, it } from 'vitest';
import { deleteFootprintVertex, insertFootprintMidpoint, snapFootprintPoint } from '../FootprintEditorService';

const points = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, { x: 4, y: 0, z: 4 }, { x: 0, y: 0, z: 4 }];

describe('footprint edit operations', () => {
  it('inserts an ordered midpoint and deletes while retaining at least three vertices', () => {
    const inserted = insertFootprintMidpoint(points, 0);
    expect(inserted[1]).toEqual({ x: 2, y: 0, z: 0 });
    expect(deleteFootprintVertex(inserted, 1)).toEqual(points);
    expect(deleteFootprintVertex(points.slice(0, 3), 1)).toHaveLength(3);
  });

  it('uses the existing one metre snap only when enabled', () => {
    expect(snapFootprintPoint({ x: 1.49, y: 3, z: 2.51 }, true)).toEqual({ x: 1, y: 0, z: 3 });
    expect(snapFootprintPoint({ x: 1.49, y: 3, z: 2.51 }, false)).toEqual({ x: 1.49, y: 0, z: 2.51 });
  });
});
