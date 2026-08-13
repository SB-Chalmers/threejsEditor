import { act, renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildingData } from '../../types/building';
import { createBuildingEditDraft, useBuildingEditSession } from '../useBuildingEditSession';

const makeBuilding = (floors = 6): BuildingData => ({
  id: 'building-a',
  mesh: new THREE.Mesh(new THREE.BoxGeometry(10, floors * 3, 8), new THREE.MeshStandardMaterial()),
  points: [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
    { x: 10, y: 0, z: 8 },
    { x: 0, y: 0, z: 8 },
  ],
  footprintArea: 80,
  metrics: { footprintArea: 80, grossFloorArea: 80 * floors, perimeter: 36, totalHeight: floors * 3 },
  floors,
  floorHeight: 3,
  color: 0x7c8fa3,
  createdAt: new Date(),
  window_to_wall_ratio: 0.4,
});

describe('useBuildingEditSession', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('keeps preview drafts separate from canonical state and commits the latest value', () => {
    let canonical = makeBuilding(6);
    const previewBuilding = vi.fn();
    const updateBuilding = vi.fn((_id, updates) => {
      canonical = {
        ...canonical,
        ...updates.config,
        points: updates.points ?? canonical.points,
      } as BuildingData;
      return canonical;
    });
    const restoreBuildingPreview = vi.fn();
    const getBuilding = vi.fn(() => canonical);
    const { result } = renderHook(() => useBuildingEditSession({
      workspaceRevision: 0,
      getBuilding,
      previewBuilding,
      updateBuilding,
      restoreBuildingPreview,
    }));

    act(() => { result.current.open('building-a'); });
    expect(result.current.draft?.floors).toBe(6);

    act(() => {
      result.current.updateDraft({ ...result.current.draft!, floors: 10 });
    });
    expect(canonical.floors).toBe(6);
    expect(previewBuilding).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(50));
    expect(previewBuilding).toHaveBeenCalledWith('building-a', expect.objectContaining({ floors: 10 }), expect.any(Array));
    expect(canonical.floors).toBe(6);

    act(() => { result.current.commit(); });
    expect(updateBuilding).toHaveBeenCalledWith('building-a', expect.objectContaining({
      config: expect.objectContaining({ floors: 10 }),
    }));
    expect(canonical.floors).toBe(10);
    expect(result.current.draft).toBeNull();
  });

  it('cancels pending work and invalidates a draft when the workspace is replaced', () => {
    const building = makeBuilding(6);
    const previewBuilding = vi.fn();
    const restoreBuildingPreview = vi.fn();
    const options = {
      getBuilding: () => building,
      previewBuilding,
      updateBuilding: vi.fn(() => building),
      restoreBuildingPreview,
    };
    const { result, rerender } = renderHook(
      ({ revision }) => useBuildingEditSession({ workspaceRevision: revision, ...options }),
      { initialProps: { revision: 0 } }
    );

    act(() => {
      result.current.open('building-a');
      result.current.updateDraft({ ...createBuildingEditDraft(building), floors: 10 });
    });
    rerender({ revision: 1 });
    expect(result.current.draft).toBeNull();

    act(() => vi.runAllTimers());
    expect(previewBuilding).not.toHaveBeenCalled();
    expect(restoreBuildingPreview).not.toHaveBeenCalled();
  });
});
