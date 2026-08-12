import type { BuildingMetrics, Point3D } from '../types/building';

export const calculateFootprintArea = (points: readonly Point3D[]): number => {
  if (points.length < 3) return 0;
  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    twiceArea += current.x * next.z - next.x * current.z;
  }
  return Math.abs(twiceArea) / 2;
};

export const calculatePerimeter = (points: readonly Point3D[]): number => {
  if (points.length < 2) return 0;
  return points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + Math.hypot(next.x - point.x, next.z - point.z);
  }, 0);
};

export const calculateBuildingMetrics = (
  points: readonly Point3D[],
  floors: number,
  floorHeight: number
): BuildingMetrics => {
  const safeFloors = Number.isFinite(floors) ? Math.max(0, floors) : 0;
  const safeFloorHeight = Number.isFinite(floorHeight) ? Math.max(0, floorHeight) : 0;
  const footprintArea = calculateFootprintArea(points);
  return {
    footprintArea,
    grossFloorArea: footprintArea * safeFloors,
    perimeter: calculatePerimeter(points),
    totalHeight: safeFloors * safeFloorHeight,
  };
};

const pointsEqual = (a: Point3D, b: Point3D, tolerance = 1e-8) =>
  Math.abs(a.x - b.x) <= tolerance && Math.abs(a.z - b.z) <= tolerance;

const orientation = (a: Point3D, b: Point3D, c: Point3D) =>
  (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);

const onSegment = (a: Point3D, b: Point3D, point: Point3D) =>
  point.x >= Math.min(a.x, b.x) - 1e-8 &&
  point.x <= Math.max(a.x, b.x) + 1e-8 &&
  point.z >= Math.min(a.z, b.z) - 1e-8 &&
  point.z <= Math.max(a.z, b.z) + 1e-8;

const segmentsIntersect = (a: Point3D, b: Point3D, c: Point3D, d: Point3D) => {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if (((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) &&
      ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0))) return true;
  return (Math.abs(o1) <= 1e-8 && onSegment(a, b, c)) ||
    (Math.abs(o2) <= 1e-8 && onSegment(a, b, d)) ||
    (Math.abs(o3) <= 1e-8 && onSegment(c, d, a)) ||
    (Math.abs(o4) <= 1e-8 && onSegment(c, d, b));
};

export const validateFootprint = (points: readonly Point3D[]): string | null => {
  if (points.length < 3) return 'A footprint needs at least three vertices.';
  if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.z))) {
    return 'Footprint coordinates must be finite numbers.';
  }
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      if (pointsEqual(points[i], points[j])) return 'Footprint vertices cannot overlap.';
    }
  }
  for (let i = 0; i < points.length; i += 1) {
    const nextI = (i + 1) % points.length;
    for (let j = i + 1; j < points.length; j += 1) {
      const nextJ = (j + 1) % points.length;
      if (i === j || nextI === j || nextJ === i) continue;
      if (segmentsIntersect(points[i], points[nextI], points[j], points[nextJ])) {
        return 'Footprint edges cannot cross.';
      }
    }
  }
  if (calculateFootprintArea(points) < 0.01) return 'Footprint area must be at least 0.01 m².';
  return null;
};
