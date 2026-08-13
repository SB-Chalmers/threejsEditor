import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BuildingData } from '../../types/building';
import { DesignExplorationService } from '../DesignExplorationService';

const makeBuilding = (): BuildingData => ({
  id: 'building-1',
  mesh: new THREE.Mesh(
    new THREE.BoxGeometry(10, 9, 8),
    new THREE.MeshStandardMaterial()
  ),
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 0, z: 8 },
    { x: 0, y: 0, z: 8 }
  ],
  footprintArea: 80,
  metrics: {
    footprintArea: 80,
    grossFloorArea: 240,
    perimeter: 36,
    totalHeight: 9
  },
  floors: 3,
  floorHeight: 3,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  window_to_wall_ratio: 0.4,
  window_overhang: false,
  window_overhang_depth: 0
});

describe('DesignExplorationService snapshots', () => {
  it('keeps baseline massing and facade values isolated from later live edits', () => {
    const service = new DesignExplorationService();
    const liveBuilding = makeBuilding();
    service.updateNodeSnapshot('baseline', { buildings: [liveBuilding] });

    liveBuilding.floors = 12;
    liveBuilding.floorHeight = 4;
    liveBuilding.window_to_wall_ratio = 0.8;
    liveBuilding.points[0].x = 99;
    liveBuilding.mesh.geometry.dispose();
    liveBuilding.mesh.geometry = new THREE.BoxGeometry(10, 48, 8);

    const reinstated = service.reinstateConfiguration('baseline');
    const restoredBuilding = reinstated?.buildings[0];

    expect(restoredBuilding?.floors).toBe(3);
    expect(restoredBuilding?.floorHeight).toBe(3);
    expect(restoredBuilding?.window_to_wall_ratio).toBe(0.4);
    expect(restoredBuilding?.points[0].x).toBe(0);
    expect(restoredBuilding).not.toHaveProperty('mesh');
  });

  it('reinstates baseline values after 6 → 2 → 10 floor simulation snapshots', () => {
    const service = new DesignExplorationService();
    const liveBuilding = makeBuilding();
    liveBuilding.floors = 6;
    liveBuilding.metrics.totalHeight = 18;
    service.updateNodeSnapshot('baseline', { buildings: [liveBuilding] });

    liveBuilding.floors = 2;
    liveBuilding.metrics.totalHeight = 6;
    service.saveConfiguration([liveBuilding], 'Two floors');

    liveBuilding.floors = 10;
    liveBuilding.metrics.totalHeight = 30;
    service.saveConfiguration([liveBuilding], 'Ten floors');

    const baseline = service.reinstateConfiguration('baseline');
    expect(baseline?.buildings[0].floors).toBe(6);
    expect(baseline?.buildings[0].metrics.totalHeight).toBe(18);
  });
});