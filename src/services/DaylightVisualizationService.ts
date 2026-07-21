import * as THREE from 'three';
import { DaylightSensorPoint } from '../types/daylight';

const OVERLAY_VISUAL_LIFT_METERS = 0.08;

class DaylightVisualizationService {
  private overlayGroup: THREE.Group | null = null;

  renderSensorPoints(scene: THREE.Scene, points: DaylightSensorPoint[]): void {
    this.clear(scene);

    if (points.length === 0) {
      return;
    }

    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const cellSize = this.estimateCellSize(points);

    const group = new THREE.Group();
    group.name = 'daylight-sensor-overlay';

    const geometry = new THREE.PlaneGeometry(cellSize, cellSize);

    points.forEach((point) => {
      const normalized = this.normalize(point.value, minValue, maxValue);
      const color = this.getColorForNormalizedValue(normalized);

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

  private normalize(value: number, minValue: number, maxValue: number): number {
    if (maxValue <= minValue) {
      return 0.5;
    }

    return Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
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

  private getColorForNormalizedValue(value: number): THREE.Color {
    if (value < 0.25) {
      return this.interpolateColor(new THREE.Color('#1d4ed8'), new THREE.Color('#06b6d4'), value / 0.25);
    }

    if (value < 0.5) {
      return this.interpolateColor(new THREE.Color('#06b6d4'), new THREE.Color('#10b981'), (value - 0.25) / 0.25);
    }

    if (value < 0.75) {
      return this.interpolateColor(new THREE.Color('#10b981'), new THREE.Color('#f59e0b'), (value - 0.5) / 0.25);
    }

    return this.interpolateColor(new THREE.Color('#f59e0b'), new THREE.Color('#ef4444'), (value - 0.75) / 0.25);
  }

  private interpolateColor(start: THREE.Color, end: THREE.Color, t: number): THREE.Color {
    return start.clone().lerp(end, Math.max(0, Math.min(1, t)));
  }
}

export const daylightVisualizationService = new DaylightVisualizationService();
