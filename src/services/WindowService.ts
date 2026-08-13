import * as THREE from 'three';
import { BuildingModel } from '../types/building';
import { getThemeColorAsHex } from '../utils/themeColors';
import { cloneBuildingModel } from '../utils/buildingModel';
import {
  buildFacadeLayout,
  getBuildingFacadeParameters,
  FacadeAperture,
} from './FacadeGeometry';

export interface WindowConfig {
  windowWidth: number;
  windowHeight: number;
  windowSpacing: number;
  offsetDistance: number;
  frameThickness: number;
  maxWindows?: number;
}

interface WindowMaterials {
  glass: THREE.Material;
  frame: THREE.Material;
  shade: THREE.Material;
}

interface BuildingWindowRecord {
  building: BuildingModel;
  config: WindowConfig;
}

const UP = new THREE.Vector3(0, 1, 0);

export class WindowService {
  private readonly scene: THREE.Scene;
  private readonly glassGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly frameGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly shadeGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly materials: WindowMaterials;
  private readonly maxWindows: number;
  private readonly buildings = new Map<string, BuildingWindowRecord>();
  private readonly renderedWindowCounts = new Map<string, number>();
  private totalWindowCount = 0;

  public readonly glassInstancedMesh: THREE.InstancedMesh;
  public readonly frameInstancedMesh: THREE.InstancedMesh;
  /** Contains Honeybee-equivalent overhang and side-fin planes. */
  public readonly overhangInstancedMesh: THREE.InstancedMesh;

  constructor(scene: THREE.Scene, config: WindowConfig) {
    this.scene = scene;
    this.maxWindows = config.maxWindows ?? 50000;
    this.materials = this.createMaterials();

    this.glassInstancedMesh = new THREE.InstancedMesh(
      this.glassGeometry,
      this.materials.glass,
      this.maxWindows
    );
    this.frameInstancedMesh = new THREE.InstancedMesh(
      this.frameGeometry,
      this.materials.frame,
      this.maxWindows * 4
    );
    this.overhangInstancedMesh = new THREE.InstancedMesh(
      this.shadeGeometry,
      this.materials.shade,
      this.maxWindows * 3
    );

    this.glassInstancedMesh.name = 'facade-glass';
    this.glassInstancedMesh.userData.analysisRole = 'facade-glass';
    this.frameInstancedMesh.name = 'facade-frames';
    this.frameInstancedMesh.userData.analysisRole = 'facade-frame';
    this.overhangInstancedMesh.name = 'facade-shades';
    this.overhangInstancedMesh.userData.analysisRole = 'facade-shade';

    this.glassInstancedMesh.castShadow = false;
    this.glassInstancedMesh.receiveShadow = true;
    this.frameInstancedMesh.castShadow = true;
    this.frameInstancedMesh.receiveShadow = true;
    this.overhangInstancedMesh.castShadow = true;
    this.overhangInstancedMesh.receiveShadow = true;

    this.scene.add(this.glassInstancedMesh);
    this.scene.add(this.frameInstancedMesh);
    this.scene.add(this.overhangInstancedMesh);
    this.clearInstanceCounts();
  }

  private createMaterials(): WindowMaterials {
    return {
      glass: new THREE.MeshPhysicalMaterial({
        color: getThemeColorAsHex('--color-window-glass', 0x607A92),
        transparent: true,
        opacity: 0.62,
        roughness: 0.34,
        metalness: 0.02,
        clearcoat: 0.35,
        clearcoatRoughness: 0.45,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
      }),
      frame: new THREE.MeshStandardMaterial({
        color: getThemeColorAsHex('--color-window-frame', 0x46515C),
        roughness: 0.7,
        metalness: 0.08
      }),
      shade: new THREE.MeshStandardMaterial({
        color: getThemeColorAsHex('--color-window-overhang', 0x737E87),
        roughness: 0.76,
        metalness: 0.02,
        side: THREE.DoubleSide
      })
    };
  }

  addBuildingWindows(building: BuildingModel, config: WindowConfig): void {
    if (!building.points || building.points.length < 3) {
      return;
    }
    this.buildings.set(building.id, {
      building: this.snapshotBuilding(building),
      config: { ...config }
    });
    this.rebuildInstances();
  }

  updateBuildingWindows(building: BuildingModel, config: WindowConfig): void {
    this.addBuildingWindows(building, config);
  }

  updateBuildingWindowsEfficient(building: BuildingModel, config: WindowConfig): void {
    this.addBuildingWindows(building, config);
  }

  updateBuildingWindowsSmooth(building: BuildingModel, config: WindowConfig, _duration = 300): void {
    void _duration;
    this.addBuildingWindows(building, config);
  }

  removeBuildingWindows(buildingId: string): void {
    if (this.buildings.delete(buildingId)) {
      this.rebuildInstances();
    }
  }

  clearAllWindows(): void {
    this.buildings.clear();
    this.renderedWindowCounts.clear();
    this.totalWindowCount = 0;
    this.clearInstanceCounts();
  }

  dispose(): void {
    this.scene.remove(this.glassInstancedMesh);
    this.scene.remove(this.frameInstancedMesh);
    this.scene.remove(this.overhangInstancedMesh);
    this.glassGeometry.dispose();
    this.frameGeometry.dispose();
    this.shadeGeometry.dispose();
    this.materials.glass.dispose();
    this.materials.frame.dispose();
    this.materials.shade.dispose();
    this.buildings.clear();
    this.renderedWindowCounts.clear();
  }

  getBuildingWindowCount(buildingId: string): number {
    return this.renderedWindowCounts.get(buildingId) ?? 0;
  }

  getTotalWindowCount(): number {
    return this.totalWindowCount;
  }

  private snapshotBuilding(building: BuildingModel): BuildingModel {
    return cloneBuildingModel(building);
  }

  private rebuildInstances(): void {
    let glassIndex = 0;
    let frameIndex = 0;
    let shadeIndex = 0;
    this.renderedWindowCounts.clear();

    for (const [buildingId, record] of this.buildings) {
      const layout = buildFacadeLayout(
        record.building.points,
        record.building.floors,
        record.building.floorHeight,
        getBuildingFacadeParameters(record.building)
      );
      const remainingCapacity = this.maxWindows - glassIndex;
      const apertures = layout.apertures.slice(0, Math.max(0, remainingCapacity));

      for (const aperture of apertures) {
        this.glassInstancedMesh.setMatrixAt(
          glassIndex,
          this.createGlassMatrix(aperture)
        );
        glassIndex += 1;

        for (const matrix of this.createFrameMatrices(aperture, record.config)) {
          this.frameInstancedMesh.setMatrixAt(frameIndex, matrix);
          frameIndex += 1;
        }

        for (const matrix of this.createShadeMatrices(aperture)) {
          this.overhangInstancedMesh.setMatrixAt(shadeIndex, matrix);
          shadeIndex += 1;
        }
      }

      this.renderedWindowCounts.set(buildingId, apertures.length);
      if (apertures.length < layout.apertures.length) {
        console.warn(`Maximum number of façade apertures reached; truncated ${buildingId}.`);
      }
    }

    this.totalWindowCount = glassIndex;
    this.glassInstancedMesh.count = glassIndex;
    this.frameInstancedMesh.count = frameIndex;
    this.overhangInstancedMesh.count = shadeIndex;
    this.glassInstancedMesh.instanceMatrix.needsUpdate = true;
    this.frameInstancedMesh.instanceMatrix.needsUpdate = true;
    this.overhangInstancedMesh.instanceMatrix.needsUpdate = true;
  }

  private createGlassMatrix(aperture: FacadeAperture): THREE.Matrix4 {
    const outward = this.toVector(aperture.outward);
    const displayRight = new THREE.Vector3().crossVectors(UP, outward).normalize();
    const rotation = this.rotationFromAxes(displayRight, UP, outward);
    const position = this.toVector(aperture.center);
    return new THREE.Matrix4().compose(
      position,
      rotation,
      new THREE.Vector3(aperture.width, aperture.height, 1)
    );
  }

  private createFrameMatrices(aperture: FacadeAperture, config: WindowConfig): THREE.Matrix4[] {
    const placementRight = this.toVector(aperture.right);
    const outward = this.toVector(aperture.outward);
    const displayRight = new THREE.Vector3().crossVectors(UP, outward).normalize();
    const rotation = this.rotationFromAxes(displayRight, UP, outward);
    const center = this.toVector(aperture.center)
      .add(outward.clone().multiplyScalar(0.004));
    const thickness = Math.min(
      config.frameThickness,
      aperture.width * 0.1,
      aperture.height * 0.1
    );
    const depth = Math.max(0.01, thickness * 0.5);
    const compose = (position: THREE.Vector3, scale: THREE.Vector3) =>
      new THREE.Matrix4().compose(position, rotation, scale);

    return [
      compose(
        center.clone().add(UP.clone().multiplyScalar(aperture.height / 2 + thickness / 2)),
        new THREE.Vector3(aperture.width + thickness * 2, thickness, depth)
      ),
      compose(
        center.clone().add(UP.clone().multiplyScalar(-aperture.height / 2 - thickness / 2)),
        new THREE.Vector3(aperture.width + thickness * 2, thickness, depth)
      ),
      compose(
        center.clone().add(placementRight.clone().multiplyScalar(-aperture.width / 2 - thickness / 2)),
        new THREE.Vector3(thickness, aperture.height, depth)
      ),
      compose(
        center.clone().add(placementRight.clone().multiplyScalar(aperture.width / 2 + thickness / 2)),
        new THREE.Vector3(thickness, aperture.height, depth)
      )
    ];
  }

  private createShadeMatrices(aperture: FacadeAperture): THREE.Matrix4[] {
    const right = this.toVector(aperture.right);
    const outward = this.toVector(aperture.outward);
    const center = this.toVector(aperture.center);
    const horizontalRotation = this.rotationFromAxes(
      right,
      outward,
      new THREE.Vector3().crossVectors(right, outward).normalize()
    );
    const finRotation = this.rotationFromAxes(
      outward,
      UP,
      new THREE.Vector3().crossVectors(outward, UP).normalize()
    );
    const overhangDepth = aperture.shades[0].depth;
    const leftDepth = aperture.shades[1].depth;
    const rightDepth = aperture.shades[2].depth;

    return [
      new THREE.Matrix4().compose(
        center.clone()
          .add(UP.clone().multiplyScalar(aperture.height / 2))
          .add(outward.clone().multiplyScalar(overhangDepth / 2)),
        horizontalRotation,
        new THREE.Vector3(aperture.width, overhangDepth, 1)
      ),
      new THREE.Matrix4().compose(
        center.clone()
          .add(right.clone().multiplyScalar(-aperture.width / 2))
          .add(outward.clone().multiplyScalar(leftDepth / 2)),
        finRotation,
        new THREE.Vector3(leftDepth, aperture.height, 1)
      ),
      new THREE.Matrix4().compose(
        center.clone()
          .add(right.clone().multiplyScalar(aperture.width / 2))
          .add(outward.clone().multiplyScalar(rightDepth / 2)),
        finRotation,
        new THREE.Vector3(rightDepth, aperture.height, 1)
      )
    ];
  }

  private rotationFromAxes(
    xAxis: THREE.Vector3,
    yAxis: THREE.Vector3,
    zAxis: THREE.Vector3
  ): THREE.Quaternion {
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
    );
  }

  private toVector(point: { x: number; y: number; z: number }): THREE.Vector3 {
    return new THREE.Vector3(point.x, point.y, point.z);
  }

  private clearInstanceCounts(): void {
    this.glassInstancedMesh.count = 0;
    this.frameInstancedMesh.count = 0;
    this.overhangInstancedMesh.count = 0;
    this.glassInstancedMesh.instanceMatrix.needsUpdate = true;
    this.frameInstancedMesh.instanceMatrix.needsUpdate = true;
    this.overhangInstancedMesh.instanceMatrix.needsUpdate = true;
  }
}
