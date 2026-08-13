import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BuildingData } from '../../types/building';
import { WindowService } from '../WindowService';
import { buildFacadeLayout, getBuildingFacadeParameters } from '../FacadeGeometry';

const config = {
  windowWidth: 1.2,
  windowHeight: 1.5,
  windowSpacing: 0.3,
  offsetDistance: 0.1,
  frameThickness: 0.05,
  maxWindows: 1000
};

const building = (): BuildingData => ({
  id: 'building-1',
  mesh: {} as BuildingData['mesh'],
  points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 8 }, { x: 0, y: 0, z: 8 }],
  footprintArea: 80,
  metrics: { footprintArea: 80, grossFloorArea: 80, perimeter: 36, totalHeight: 3 },
  floors: 1,
  floorHeight: 3,
  createdAt: new Date(),
  window_to_wall_ratio: 0.4,
  window_overhang: false,
  window_overhang_depth: 0.5
});

const scaleAt = (mesh: THREE.InstancedMesh, index: number): THREE.Vector3 => {
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3();
  mesh.getMatrixAt(index, matrix);
  matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  return scale;
};

describe('WindowService facade overlays', () => {
  it('renders exact glazing, decorative frames, and three baseline shade planes per aperture', () => {
    const service = new WindowService(new THREE.Scene(), config);
    const testBuilding = building();
    const apertures = buildFacadeLayout(
      testBuilding.points,
      testBuilding.floors,
      testBuilding.floorHeight,
      getBuildingFacadeParameters(testBuilding)
    ).apertures;
    service.addBuildingWindows(testBuilding, config);

    expect(service.getTotalWindowCount()).toBe(apertures.length);
    expect(service.glassInstancedMesh.count).toBe(apertures.length);
    expect(service.frameInstancedMesh.count).toBe(apertures.length * 4);
    expect(service.overhangInstancedMesh.count).toBe(apertures.length * 3);
    expect(scaleAt(service.glassInstancedMesh, 0).x).toBeCloseTo(apertures[0].width, 6);
    expect(scaleAt(service.glassInstancedMesh, 0).y).toBeCloseTo(apertures[0].height, 6);
    const glassMaterial = service.glassInstancedMesh.material as THREE.MeshPhongMaterial;
    expect(glassMaterial.polygonOffset).toBe(true);
    expect(glassMaterial.polygonOffsetFactor).toBe(-2);
    expect(glassMaterial.polygonOffsetUnits).toBe(-2);
    expect(scaleAt(service.overhangInstancedMesh, 0).y).toBeCloseTo(0.3, 6);
    expect(scaleAt(service.overhangInstancedMesh, 1).x).toBeCloseTo(0.3, 6);
    expect(scaleAt(service.overhangInstancedMesh, 2).x).toBeCloseTo(0.3, 6);
    service.dispose();
  });

  it('adds enabled additional depth only to horizontal overhang planes', () => {
    const service = new WindowService(new THREE.Scene(), config);
    service.addBuildingWindows({ ...building(), window_overhang: true }, config);

    expect(scaleAt(service.overhangInstancedMesh, 0).y).toBeCloseTo(0.8, 6);
    expect(scaleAt(service.overhangInstancedMesh, 1).x).toBeCloseTo(0.3, 6);
    expect(scaleAt(service.overhangInstancedMesh, 2).x).toBeCloseTo(0.3, 6);
    service.dispose();
  });

  it.each([
    ['counter-clockwise', building().points],
    ['clockwise', [...building().points].reverse()],
    ['irregular', [
      { x: 0, y: 0, z: 0 },
      { x: 7, y: 0, z: -1 },
      { x: 11, y: 0, z: 4 },
      { x: 5, y: 0, z: 9 },
      { x: -2, y: 0, z: 5 },
    ]],
  ])('uses a proper right-handed glass/frame transform for a %s footprint', (_label, points) => {
    const testBuilding = { ...building(), points };
    const service = new WindowService(new THREE.Scene(), config);
    service.addBuildingWindows(testBuilding, config);
    const apertures = buildFacadeLayout(
      testBuilding.points,
      testBuilding.floors,
      testBuilding.floorHeight,
      getBuildingFacadeParameters(testBuilding)
    ).apertures;

    apertures.forEach((aperture, index) => {
      const glassMatrix = new THREE.Matrix4();
      service.glassInstancedMesh.getMatrixAt(index, glassMatrix);
      const glassQuaternion = new THREE.Quaternion();
      glassMatrix.decompose(new THREE.Vector3(), glassQuaternion, new THREE.Vector3());
      const rotation = new THREE.Matrix3().setFromMatrix4(
        new THREE.Matrix4().makeRotationFromQuaternion(glassQuaternion)
      );
      expect(rotation.determinant()).toBeCloseTo(1, 6);

      const normal = new THREE.Vector3(0, 0, 1).applyMatrix3(rotation).normalize();
      expect(normal.x).toBeCloseTo(aperture.outward.x, 6);
      expect(normal.y).toBeCloseTo(aperture.outward.y, 6);
      expect(normal.z).toBeCloseTo(aperture.outward.z, 6);

      const frameMatrix = new THREE.Matrix4();
      service.frameInstancedMesh.getMatrixAt(index * 4, frameMatrix);
      const frameQuaternion = new THREE.Quaternion();
      frameMatrix.decompose(new THREE.Vector3(), frameQuaternion, new THREE.Vector3());
      const frameRotation = new THREE.Matrix3().setFromMatrix4(
        new THREE.Matrix4().makeRotationFromQuaternion(frameQuaternion)
      );
      const frameNormal = new THREE.Vector3(0, 0, 1).applyMatrix3(frameRotation).normalize();
      expect(frameRotation.determinant()).toBeCloseTo(1, 6);
      expect(frameNormal.dot(new THREE.Vector3(
        aperture.outward.x,
        aperture.outward.y,
        aperture.outward.z
      ))).toBeCloseTo(1, 6);
    });
    service.dispose();
  });
});
