import { act, renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BuildingService } from '../../services/BuildingService';
import { WindowService } from '../../services/WindowService';
import { buildFacadeLayout, getBuildingFacadeParameters } from '../../services/FacadeGeometry';
import type { BuildingConfig } from '../../types/building';
import { useBuildingManager } from '../useBuildingManager';

const points = [
  { x: 0, y: 0, z: 0 },
  { x: 10, y: 0, z: 0 },
  { x: 10, y: 0, z: 8 },
  { x: 0, y: 0, z: 8 }
];

const config = (floors: number): BuildingConfig => ({
  floors,
  floorHeight: 3,
  color: 0x7c8fa3,
  window_to_wall_ratio: 0.4
});

const meshHeight = (mesh: THREE.Mesh): number => {
  mesh.geometry.computeBoundingBox();
  const bounds = mesh.geometry.boundingBox;
  return bounds ? bounds.max.y - bounds.min.y : 0;
};

describe('useBuildingManager canonical scene ownership', () => {
  it('updates preview and committed massing on the live scene mesh', () => {
    const scene = new THREE.Scene();
    const buildingService = new BuildingService(scene);
    const mesh = buildingService.createBuilding(points, config(6));
    const { result } = renderHook(() => useBuildingManager(scene, null, null));

    let buildingId = '';
    act(() => {
      buildingId = result.current.addBuilding(mesh, points, config(6))?.id ?? '';
    });

    expect(meshHeight(mesh)).toBeCloseTo(18, 6);

    act(() => {
      result.current.previewBuilding(buildingId, config(12), points);
    });
    expect(meshHeight(mesh)).toBeCloseTo(36, 6);

    act(() => {
      result.current.updateBuilding(buildingId, { points, config: config(12) });
    });

    expect(result.current.getBuildings()[0].floors).toBe(12);
    expect(result.current.getBuildings()[0].mesh).toBe(mesh);
    expect(meshHeight(mesh)).toBeCloseTo(36, 6);
  });

  it('keeps multi-building massing independent across previews and commits', () => {
    const scene = new THREE.Scene();
    const buildingService = new BuildingService(scene);
    const firstMesh = buildingService.createBuilding(points, config(6));
    const secondPoints = points.map(point => ({ ...point, x: point.x + 20 }));
    const secondMesh = buildingService.createBuilding(secondPoints, config(8));
    secondMesh.userData.buildingId = 'building-b';
    const { result } = renderHook(() => useBuildingManager(scene, null, null));

    let firstId = '';
    act(() => {
      firstId = result.current.addBuilding(firstMesh, points, config(6))?.id ?? '';
      result.current.addBuilding(secondMesh, secondPoints, config(8));
    });

    act(() => {
      result.current.previewBuilding(firstId, config(12), points);
      result.current.updateBuilding(firstId, { points, config: config(12) });
    });

    const liveBuildings = result.current.getBuildings();
    expect(liveBuildings.map(building => [building.id, building.floors])).toEqual([
      [firstId, 12],
      ['building-b', 8]
    ]);
    expect(meshHeight(firstMesh)).toBeCloseTo(36, 6);
    expect(meshHeight(secondMesh)).toBeCloseTo(24, 6);
  });

  it('atomically restores a same-id 6-floor baseline after 2- and 10-floor iterations', () => {
    const scene = new THREE.Scene();
    const buildingService = new BuildingService(scene);
    const windowService = new WindowService(scene, {
      windowWidth: 1.2,
      windowHeight: 1.5,
      windowSpacing: 0,
      offsetDistance: 0.1,
      frameThickness: 0.05,
      maxWindows: 5000,
    });
    const initialMesh = buildingService.createBuilding(points, config(6));
    initialMesh.userData.buildingId = 'building-a';
    const { result } = renderHook(() => useBuildingManager(scene, null, windowService));

    act(() => {
      result.current.addBuilding(initialMesh, points, config(6));
    });
    const baseline = result.current.captureSnapshot();

    act(() => {
      result.current.updateBuilding('building-a', { points, config: config(2) });
      result.current.updateBuilding('building-a', { points, config: config(10) });
      result.current.selectBuilding(result.current.getBuilding('building-a') ?? null);
    });
    expect(result.current.getBuilding('building-a')?.floors).toBe(10);

    act(() => {
      result.current.replaceWorkspace(baseline);
    });

    const restored = result.current.getBuilding('building-a');
    expect(restored?.floors).toBe(6);
    expect(restored?.mesh).not.toBe(initialMesh);
    expect(meshHeight(restored!.mesh)).toBeCloseTo(18, 6);
    expect(restored?.floorLines?.children).toHaveLength(5);
    expect(result.current.selectedBuilding).toBeNull();
    expect(windowService.getBuildingWindowCount('building-a')).toBe(
      buildFacadeLayout(restored!.points, 6, 3, getBuildingFacadeParameters(restored!)).apertures.length
    );

    act(() => {
      result.current.previewBuilding('building-a', config(8), points);
    });
    expect(meshHeight(restored!.mesh)).toBeCloseTo(24, 6);
    expect(restored?.floorLines?.children).toHaveLength(7);

    act(() => {
      result.current.restoreBuildingPreview('building-a');
    });
    expect(meshHeight(restored!.mesh)).toBeCloseTo(18, 6);
    expect(restored?.floorLines?.children).toHaveLength(5);
    windowService.dispose();
  });
});