import * as THREE from 'three';
import { DaylightSensorPoint } from '../types/daylight';

const OVERLAY_VISUAL_LIFT_METERS = 0.08;

export const getOverlayPointsForResults = (
  resultsByBuildingId: Record<string, DaylightRunSummary> | undefined,
  mode: 'df' | 'sda' = 'df'
): DaylightSensorPoint[] => {
  if (!resultsByBuildingId) {
    return [];
  }

  return Object.values(resultsByBuildingId).flatMap((result) => {
    if (mode === 'sda' && result.sdaPoints?.length) {
      return result.sdaPoints;
    }

    return result.points;
  });
};

/**
 * Returns one array of points per building so each group can be rendered
 * with its own cell-size estimate, avoiding cross-building distance artefacts.
 */
export const getOverlayGroupsForResults = (
  resultsByBuildingId: Record<string, DaylightRunSummary> | undefined,
  mode: 'df' | 'sda' = 'df'
): DaylightSensorPoint[][] => {
  if (!resultsByBuildingId) {
    return [];
  }

  return Object.values(resultsByBuildingId)
    .map((result) => (mode === 'sda' && result.sdaPoints?.length ? result.sdaPoints : result.points))
    .filter((pts) => pts.length > 0);
};

class DaylightVisualizationService {
  private overlayGroup: THREE.Group | null = null;

  /**
   * Render a flat array of sensor points. Use renderSensorPointGroups when
   * points come from multiple buildings to avoid cell-size estimation errors.
   */
  renderSensorPoints(scene: THREE.Scene, points: DaylightSensorPoint[]): void {
    this.clear(scene);

    if (points.length === 0) {
      return;
    }

    const cellSize = this.estimateCellSize(points);

    const group = new THREE.Group();
    group.name = 'daylight-sensor-overlay';

    const geometry = new THREE.PlaneGeometry(cellSize, cellSize);

    points.forEach((point) => {
      const color = this.getColorForDfAbsolute(point.value);

      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        depthTest: false
      });

      const marker = new THREE.Mesh(geometry.clone(), material);
      marker.position.set(point.x, point.y + OVERLAY_VISUAL_LIFT_METERS, point.z);
      marker.rotation.x = -Math.PI / 2;
      marker.renderOrder = 200;
      group.add(marker);
    });

    scene.add(group);
    this.overlayGroup = group;
  }

  /**
   * Render points from multiple buildings, each group using its own estimated
   * cell size but sharing a global colour normalisation range.
   */
  renderSensorPointGroups(scene: THREE.Scene, groups: DaylightSensorPoint[][], mode: 'df' | 'sda' = 'df'): void {
    this.clear(scene);

    const allPoints = groups.flat();
    if (allPoints.length === 0) {
      return;
    }

    const group = new THREE.Group();
    group.name = 'daylight-sensor-overlay';

    groups.forEach((buildingPoints) => {
      if (buildingPoints.length === 0) {
        return;
      }

      const cellSize = this.estimateCellSize(buildingPoints);
      const geometry = new THREE.PlaneGeometry(cellSize, cellSize);

      buildingPoints.forEach((point) => {
        const color = mode === 'sda'
          ? this.getColorForSdaAbsolute(point.value)
          : this.getColorForDfAbsolute(point.value);

        const material = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          depthTest: false
        });

        const marker = new THREE.Mesh(geometry.clone(), material);
        marker.position.set(point.x, point.y + OVERLAY_VISUAL_LIFT_METERS, point.z);
        marker.rotation.x = -Math.PI / 2;
        marker.renderOrder = 200;
        group.add(marker);
      });
    });

    scene.add(group);
    this.overlayGroup = group;
  }

  clear(scene: THREE.Scene): void {
    if (!this.overlayGroup) {
      return;
    }

    this.overlayGroup.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      object.geometry.dispose();

      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material.dispose();
      }
    });

    scene.remove(this.overlayGroup);
    this.overlayGroup = null;
  }

  /**
   * DF colour scale anchored to CIBSE/BRE absolute thresholds:
   *   < 1%   dark navy → blue   — very poor / inadequate
   *   1–2%   blue → cyan        — below target
   *   2–5%   cyan → green       — target zone (≥ 2% is standard for offices)
   *   5–10%  green → amber      — well-daylit, monitor glare
   *   10%+   amber → red        — overlit / glare risk
   */
  private getColorForDfAbsolute(dfPercent: number): THREE.Color {
    const v = Math.max(0, dfPercent);
    if (v < 1) return this.interpolateColor(new THREE.Color('#1e3a8a'), new THREE.Color('#1d4ed8'), v);
    if (v < 2) return this.interpolateColor(new THREE.Color('#1d4ed8'), new THREE.Color('#06b6d4'), v - 1);
    if (v < 5) return this.interpolateColor(new THREE.Color('#06b6d4'), new THREE.Color('#22c55e'), (v - 2) / 3);
    if (v < 10) return this.interpolateColor(new THREE.Color('#22c55e'), new THREE.Color('#f59e0b'), (v - 5) / 5);
    return this.interpolateColor(new THREE.Color('#f59e0b'), new THREE.Color('#ef4444'), Math.min(1, (v - 10) / 5));
  }

  /**
   * sDA colour — binary pass / fail matching the result-view heatmap.
   * Threshold: 50 % (matches backend sda_target_pct default and sdaPassMask).
   *   ≥ 50 %  → green  (#22c55e)  — passes sDA300/50
   *   < 50 %  → red    (#ef4444)  — fails
   */
  private getColorForSdaAbsolute(sdaPercent: number): THREE.Color {
    return sdaPercent >= 50
      ? new THREE.Color('#22c55e')
      : new THREE.Color('#ef4444');
  }

  private estimateCellSize(points: DaylightSensorPoint[]): number {
    if (points.length < 2) {
      return 0.4;
    }

    const epsilon = 1e-6;
    const sortedX = [...new Set(points.map((point) => point.x))].sort((a, b) => a - b);
    const sortedZ = [...new Set(points.map((point) => point.z))].sort((a, b) => a - b);

    const minDelta = (values: number[]): number => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 1; i < values.length; i += 1) {
        const delta = values[i] - values[i - 1];
        if (delta > epsilon && delta < best) {
          best = delta;
        }
      }
      return Number.isFinite(best) ? best : Number.POSITIVE_INFINITY;
    };

    const dx = minDelta(sortedX);
    const dz = minDelta(sortedZ);
    const spacing = Math.min(dx, dz);

    if (!Number.isFinite(spacing)) {
      return 0.4;
    }

    return Math.max(0.1, spacing * 0.9);
  }

  private interpolateColor(start: THREE.Color, end: THREE.Color, t: number): THREE.Color {
    return start.clone().lerp(end, Math.max(0, Math.min(1, t)));
  }
}

export const daylightVisualizationService = new DaylightVisualizationService();
