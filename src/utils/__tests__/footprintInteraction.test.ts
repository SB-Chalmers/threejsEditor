import { describe, expect, it } from 'vitest';
import { centroid, rotateFootprint, translateFootprint, resolveSnap, nearestOnSegment } from '../footprintInteraction';
import { calculateBuildingMetrics, validateFootprint } from '../buildingMetrics';
const points = [[0,0],[10,0],[10,4],[4,4],[4,10],[0,10]].map(([x,z]) => ({x,y:0,z}));
const project = (p: {x:number;z:number}) => ({x:p.x*10,y:p.z*10});
describe('footprint transformations and snapping', () => {
  it('uses the area centroid of a concave polygon and preserves invariants through repeated rotations', () => {
    expect(centroid(points).x).toBeCloseTo(3.875);
    const baseline = calculateBuildingMetrics(points, 6, 3.5);
    let rotated = points;
    for (let i=0;i<360;i++) rotated=rotateFootprint(rotated, Math.PI/180);
    expect(validateFootprint(rotated)).toBeNull();
    const metrics = calculateBuildingMetrics(rotated,6,3.5);
    Object.keys(baseline).forEach(key => expect(metrics[key as keyof typeof metrics]).toBeCloseTo(baseline[key as keyof typeof baseline],8));
    rotated.forEach((p,i) => {expect(p.x).toBeCloseTo(points[i].x,8);expect(p.z).toBeCloseTo(points[i].z,8)});
    expect(centroid(translateFootprint(points,20,-8)).x).toBeCloseTo(23.875);
  });
  it('prioritizes closure and vertices, holds a snap to 14px, then releases it', () => {
    const origin = points[0];
    const snap=resolveSnap({x:.8,y:0,z:.2},project,[origin],{grid:1,closure:origin});
    expect(snap?.kind).toBe('Close');
    expect(resolveSnap({x:1.2,y:0,z:0},project,[origin],{grid:null,closure:origin,previous:snap})?.kind).toBe('Close');
    expect(resolveSnap({x:1.5,y:0,z:0},project,[origin],{grid:null,closure:origin,previous:snap})?.kind).not.toBe('Close');
    expect(resolveSnap(origin,project,[origin],{grid:1,bypass:true})).toBeNull();
  });
  it('keeps snap radius in pixels at different zoom levels and respects axis constraints', () => {
    for (const scale of [2,10,100]) {
      const projection=(p: {x:number;z:number})=>({x:p.x*scale,y:p.z*scale});
      expect(resolveSnap({x:9/scale,y:0,z:0},projection,[points[0]],{grid:null})?.kind).toBe('Vertex');
    }
    const snap=resolveSnap({x:7,y:0,z:2},project,[],{grid:null,axis:true,origin:points[0]});
    expect(snap?.point).toEqual({x:7,y:0,z:0});
    expect(nearestOnSegment({x:23,y:4},{x:0,y:0},{x:100,y:0}).t).toBe(.23);
  });
  it('rejects nonfinite, duplicate and crossing vertices', () => {
    expect(validateFootprint([{x:0,y:NaN,z:0},...points.slice(1)])).toMatch(/finite/);
    expect(validateFootprint([...points,points[0]])).toMatch(/overlap/);
    expect(validateFootprint([points[0],points[2],points[1],points[5]])).toMatch(/cross/);
  });
});

describe('drawing constraints', () => {
  it('snaps rotation to 5° by default, 15° with Shift, and allows Alt to bypass', async () => {
    const { snapRotation } = await import('../footprintInteraction');
    const radians = (degrees: number) => degrees * Math.PI / 180;
    expect(snapRotation(radians(38), {}) * 180 / Math.PI).toBeCloseTo(40);
    expect(snapRotation(radians(-38), {}) * 180 / Math.PI).toBeCloseTo(-40);
    expect(snapRotation(radians(38), { shiftKey: true }) * 180 / Math.PI).toBeCloseTo(45);
    expect(snapRotation(radians(38), { altKey: true }) * 180 / Math.PI).toBeCloseTo(38);
  });
});
