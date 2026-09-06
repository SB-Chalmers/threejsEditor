import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_BUILDING_COLOR, type BuildingConfig, type BuildingData, type BuildingModel, type Point3D } from '../types/building';
import { validateFootprint } from '../utils/buildingMetrics';
import { clampWwr } from '../services/FacadeGeometry';

export type BuildingEditDraft = BuildingConfig & {
  name: string;
  description: string;
  points: Point3D[];
};

interface EditSession {
  token: number;
  buildingId: string;
  workspaceRevision: number;
  baseDraft: BuildingEditDraft;
  draft: BuildingEditDraft;
}

interface BuildingEditSessionOptions {
  workspaceRevision: number;
  getBuilding: (buildingId: string) => BuildingData | undefined;
  previewBuilding: (buildingId: string, config: BuildingConfig, points?: Point3D[]) => void;
  updateBuilding: (
    buildingId: string,
    updates: Partial<BuildingData> & { config?: BuildingConfig }
  ) => BuildingData | undefined;
  restoreBuildingPreview: (buildingId: string) => void;
}

export const createBuildingEditDraft = (building: BuildingModel): BuildingEditDraft => ({
  name: building.name ?? '',
  description: building.description ?? '',
  points: building.points.map(point => ({ ...point })),
  floors: building.floors,
  floorHeight: building.floorHeight,
  color: building.color ?? DEFAULT_BUILDING_COLOR,
  window_to_wall_ratio: clampWwr(building.window_to_wall_ratio),
  window_overhang: building.window_overhang ?? false,
  window_overhang_depth: building.window_overhang_depth ?? 0,
  wall_construction: building.wall_construction ?? 'Default Wall',
  floor_construction: building.floor_construction ?? 'Default Floor',
  roof_construction: building.roof_construction ?? 'Default Roof',
  window_construction: building.window_construction ?? 'Default Window',
  structural_system: building.structural_system ?? 'Concrete',
  building_program: building.building_program ?? 'Office',
  hvac_system: building.hvac_system ?? 'Default HVAC',
  natural_ventilation: building.natural_ventilation ?? false,
});

const sameDraft = (a: BuildingEditDraft, b: BuildingEditDraft) =>
  JSON.stringify({ ...a, points: undefined }) === JSON.stringify({ ...b, points: undefined }) &&
  a.points.length === b.points.length && a.points.every((p, i) =>
    Math.abs(p.x - b.points[i].x) < 1e-8 && Math.abs(p.y - b.points[i].y) < 1e-8 && Math.abs(p.z - b.points[i].z) < 1e-8);

const cloneDraft = (draft: BuildingEditDraft): BuildingEditDraft => ({
  ...draft,
  points: draft.points.map(point => ({ ...point })),
});

export const useBuildingEditSession = ({
  workspaceRevision,
  getBuilding,
  previewBuilding,
  updateBuilding,
  restoreBuildingPreview,
}: BuildingEditSessionOptions) => {
  const [session, setSession] = useState<EditSession | null>(null);
  const sessionRef = useRef<EditSession | null>(null);
  const previewTimerRef = useRef<number | null>(null);
  const tokenRef = useRef(0);

  const publishSession = useCallback((next: EditSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const cancelPendingPreview = useCallback(() => {
    if (previewTimerRef.current !== null) {
      window.cancelAnimationFrame(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  const open = useCallback((buildingId: string): boolean => {
    const building = getBuilding(buildingId);
    if (!building) return false;
    cancelPendingPreview();
    const baseDraft = createBuildingEditDraft(building);
    publishSession({
      token: ++tokenRef.current,
      buildingId,
      workspaceRevision,
      baseDraft,
      draft: cloneDraft(baseDraft),
    });
    return true;
  }, [cancelPendingPreview, getBuilding, publishSession, workspaceRevision]);

  const updateDraft = useCallback((nextDraft: BuildingEditDraft) => {
    const current = sessionRef.current;
    if (!current) return;
    const next: EditSession = { ...current, draft: cloneDraft(nextDraft) };
    publishSession(next);
    if (previewTimerRef.current !== null) return;
    previewTimerRef.current = window.requestAnimationFrame(() => {
      previewTimerRef.current = null;
      const latest = sessionRef.current;
      if (!latest || latest.token !== next.token || validateFootprint(latest.draft.points)) return;
      previewBuilding(latest.buildingId, latest.draft, latest.draft.points);
    });
  }, [previewBuilding, publishSession]);

  const updateFootprint = useCallback((points: Point3D[]) => {
    const current = sessionRef.current;
    if (!current) return;
    updateDraft({ ...current.draft, points: points.map(point => ({ ...point })) });
  }, [updateDraft]);

  const reset = useCallback(() => {
    const current = sessionRef.current;
    if (!current) return;
    cancelPendingPreview();
    const draft = cloneDraft(current.baseDraft);
    publishSession({ ...current, draft });
    previewBuilding(current.buildingId, draft, draft.points);
  }, [cancelPendingPreview, previewBuilding, publishSession]);

  const commit = useCallback((): BuildingData | undefined => {
    const current = sessionRef.current;
    if (!current) return undefined;
    cancelPendingPreview();
    if (validateFootprint(current.draft.points)) {
      restoreBuildingPreview(current.buildingId);
      publishSession(null);
      return undefined;
    }
    if (sameDraft(current.baseDraft, current.draft)) {
      restoreBuildingPreview(current.buildingId);
      publishSession(null);
      return getBuilding(current.buildingId);
    }
    const updated = updateBuilding(current.buildingId, {
      points: current.draft.points,
      config: current.draft,
    });
    publishSession(null);
    return updated;
  }, [cancelPendingPreview, publishSession, updateBuilding, getBuilding, restoreBuildingPreview]);

  const cancel = useCallback(() => {
    const current = sessionRef.current;
    cancelPendingPreview();
    if (current && getBuilding(current.buildingId)) {
      restoreBuildingPreview(current.buildingId);
    }
    publishSession(null);
  }, [cancelPendingPreview, getBuilding, publishSession, restoreBuildingPreview]);

  const discard = useCallback(() => {
    cancelPendingPreview();
    publishSession(null);
  }, [cancelPendingPreview, publishSession]);

  useEffect(() => {
    const current = sessionRef.current;
    if (current && current.workspaceRevision !== workspaceRevision) {
      discard();
    }
  }, [discard, workspaceRevision]);

  useEffect(() => cancelPendingPreview, [cancelPendingPreview]);

  return {
    buildingId: session?.buildingId ?? null,
    token: session?.token ?? 0,
    draft: session?.draft ?? null,
    baseDraft: session?.baseDraft ?? null,
    open,
    begin: open,
    getDraft: () => sessionRef.current?.draft ?? null,
    updateDraft,
    updateFootprint,
    reset,
    commit,
    cancel,
    discard,
  };
};