import * as THREE from 'three';
import {
  DaylightOverlayDataset,
  DaylightRunSummary,
  DaylightSensorPoint,
} from '../types/daylight';

const HISTORICAL_CELL_SIZE_METERS = 0.5;

export const getOverlayPointsForResults = (
  resultsByBuildingId: Record<string, DaylightRunSummary> | undefined,
  mode: 'df' | 'sda' = 'df'
): DaylightSensorPoint[] => {
  if (!resultsByBuildingId) return [];
  return Object.values(resultsByBuildingId).flatMap((result) =>
    mode === 'sda' && result.sdaPoints?.length ? result.sdaPoints : result.points
  );
};

/** Preserve each result's backend point order and exact submitted grid dimensions. */
export const getOverlayDatasetsForResults = (
  resultsByBuildingId: Record<string, DaylightRunSummary> | undefined,
  mode: 'df' | 'sda' = 'df'
): DaylightOverlayDataset[] => {
  if (!resultsByBuildingId) return [];

  return Object.values(resultsByBuildingId).flatMap((result) => {
    const points = mode === 'sda' && result.sdaPoints?.length
      ? result.sdaPoints
      : result.points;
    if (points.length === 0) return [];

    return [{
      points,
      cellSizeX: result.sensorGrid?.x_dim ?? HISTORICAL_CELL_SIZE_METERS,
      cellSizeZ: result.sensorGrid?.y_dim ?? HISTORICAL_CELL_SIZE_METERS,
    }];
  });
};

/** @deprecated Use getOverlayDatasetsForResults so cell dimensions are retained. */
export const getOverlayGroupsForResults = (
  resultsByBuildingId: Record<string, DaylightRunSummary> | undefined,
  mode: 'df' | 'sda' = 'df'
): DaylightSensorPoint[][] => getOverlayDatasetsForResults(resultsByBuildingId, mode)
  .map((dataset) => dataset.points);

export class DaylightVisualizationService {
  private overlayGroup: THREE.Group | null = null;
  private visible = false;

  get isVisible(): boolean {
    return this.visible;
  }

  renderDatasets(
    scene: THREE.Scene,
    datasets: DaylightOverlayDataset[],
    mode: 'df' | 'sda' = 'df'
  ): void {
    this.clear(scene);
    if (!datasets.some((dataset) => dataset.points.length > 0)) return;

    const group = new THREE.Group();
    group.name = 'daylight-sensor-overlay';
    group.userData.analysisRole = 'daylight-overlay';
    group.userData.isDaylightOverlay = true;

    datasets.forEach((dataset, datasetIndex) => {
      if (dataset.points.length === 0) return;

      const geometry = new THREE.PlaneGeometry(dataset.cellSizeX, dataset.cellSizeZ);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: false,
        opacity: 1,
        depthTest: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, dataset.points.length);
      mesh.name = `daylight-sensor-dataset-${datasetIndex}`;
      mesh.userData.analysisRole = 'daylight-overlay';
      mesh.userData.isDaylightOverlay = true;

      const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
      const scale = new THREE.Vector3(1, 1, 1);
      dataset.points.forEach((point, index) => {
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(point.x, point.y, point.z),
          rotation,
          scale
        );
        mesh.setMatrixAt(index, matrix);
        mesh.setColorAt(index, mode === 'sda'
          ? this.getColorForSdaAbsolute(point.value)
          : this.getColorForDfAbsolute(point.value));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
    });

    scene.add(group);
    this.overlayGroup = group;
    this.setVisible(scene, true);
  }

  renderSensorPoints(scene: THREE.Scene, points: DaylightSensorPoint[]): void {
    this.renderDatasets(scene, [{
      points,
      cellSizeX: HISTORICAL_CELL_SIZE_METERS,
      cellSizeZ: HISTORICAL_CELL_SIZE_METERS,
    }]);
  }

  renderSensorPointGroups(
    scene: THREE.Scene,
    groups: DaylightSensorPoint[][],
    mode: 'df' | 'sda' = 'df'
  ): void {
    this.renderDatasets(scene, groups.map((points) => ({
      points,
      cellSizeX: HISTORICAL_CELL_SIZE_METERS,
      cellSizeZ: HISTORICAL_CELL_SIZE_METERS,
    })), mode);
  }

  setVisible(_scene: THREE.Scene, visible: boolean): void {
    if (this.overlayGroup) this.overlayGroup.visible = visible;
    this.visible = Boolean(this.overlayGroup && visible);
  }

  clear(scene: THREE.Scene): void {
    if (!this.overlayGroup) {
      this.visible = false;
      return;
    }

    this.overlayGroup.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    });
    scene.remove(this.overlayGroup);
    this.overlayGroup = null;
    this.visible = false;
  }

  private getColorForDfAbsolute(dfPercent: number): THREE.Color {
    const v = Math.max(0, dfPercent);
    if (v < 1) return this.interpolateColor(new THREE.Color('#1e3a8a'), new THREE.Color('#1d4ed8'), v);
    if (v < 2) return this.interpolateColor(new THREE.Color('#1d4ed8'), new THREE.Color('#06b6d4'), v - 1);
    if (v < 5) return this.interpolateColor(new THREE.Color('#06b6d4'), new THREE.Color('#22c55e'), (v - 2) / 3);
    if (v < 10) return this.interpolateColor(new THREE.Color('#22c55e'), new THREE.Color('#f59e0b'), (v - 5) / 5);
    return this.interpolateColor(new THREE.Color('#f59e0b'), new THREE.Color('#ef4444'), Math.min(1, (v - 10) / 5));
  }

  private getColorForSdaAbsolute(sdaPercent: number): THREE.Color {
    return sdaPercent >= 50 ? new THREE.Color('#22c55e') : new THREE.Color('#ef4444');
  }

  private interpolateColor(start: THREE.Color, end: THREE.Color, t: number): THREE.Color {
    return start.clone().lerp(end, Math.max(0, Math.min(1, t)));
  }
}

export const daylightVisualizationService = new DaylightVisualizationService();
