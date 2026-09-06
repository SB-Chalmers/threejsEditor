import * as THREE from 'three';

export type SceneAppearanceMode =
  | { kind: 'normal' }
  | { kind: 'editing'; buildingId: string }
  | { kind: 'daylight-analysis' };

type MaterialObject = THREE.Object3D & { material: THREE.Material | THREE.Material[] };

export class SceneAppearanceManager {
  private mode: SceneAppearanceMode = { kind: 'normal' };
  private readonly originalMaterials = new Map<MaterialObject, THREE.Material | THREE.Material[]>();
  private readonly originalShadows = new Map<THREE.Object3D, { castShadow: boolean; receiveShadow: boolean }>();

  get currentMode(): SceneAppearanceMode {
    return this.mode;
  }

  setMode(scene: THREE.Scene, mode: SceneAppearanceMode): void {
    this.restore();
    this.mode = mode;
    if (mode.kind === 'normal') return;

    scene.traverse((object) => {
      if (!this.hasMaterial(object) || this.shouldIgnore(object)) return;
      if (mode.kind === 'editing' && object.userData.buildingId === mode.buildingId) return;
      // WindowService separates the selected facade from the context facade batches.
      if (mode.kind === 'editing' && typeof object.userData.analysisRole === 'string' && object.userData.analysisRole.startsWith('facade-') && !object.userData.facadeContext) return;

      const opacity = this.getGhostOpacity(object, mode);
      this.ghostObject(object, opacity, mode);
    });
  }

  restore(): void {
    this.originalMaterials.forEach((original, object) => {
      const current = object.material;
      if (Array.isArray(current)) current.forEach((material) => material.dispose());
      else current.dispose();
      object.material = original;
    });
    this.originalMaterials.clear();

    this.originalShadows.forEach((settings, object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = settings.castShadow;
        object.receiveShadow = settings.receiveShadow;
      }
    });
    this.originalShadows.clear();
    this.mode = { kind: 'normal' };
  }

  private ghostObject(object: MaterialObject, opacity: number, mode: SceneAppearanceMode): void {
    this.originalMaterials.set(object, object.material);
    if (object instanceof THREE.Mesh) {
      this.originalShadows.set(object, {
        castShadow: object.castShadow,
        receiveShadow: object.receiveShadow,
      });
      object.castShadow = false;
    }

    const clone = (material: THREE.Material): THREE.Material => {
      const ghost = material.clone();
      const opaqueContext = mode.kind === 'editing' && object.userData.analysisRole === 'context-massing';
      ghost.transparent = !opaqueContext;
      ghost.opacity = opaqueContext ? 1 : opacity;
      ghost.depthTest = true;
      ghost.depthWrite = opaqueContext;
      if ('color' in ghost && ghost.color instanceof THREE.Color) {
        const hsl = { h: 0, s: 0, l: 0 };
        ghost.color.getHSL(hsl);
        ghost.color.setHSL(
          hsl.h,
          hsl.s * 0.2,
          opaqueContext ? Math.max(0.66, hsl.l) : Math.max(0.35, hsl.l * 0.85)
        );
      }
      ghost.needsUpdate = true;
      return ghost;
    };

    object.material = Array.isArray(object.material)
      ? object.material.map(clone)
      : clone(object.material);
  }

  private getGhostOpacity(object: THREE.Object3D, mode: SceneAppearanceMode): number {
    const role = object.userData.analysisRole;
    if (mode.kind === 'editing') {
      if (role === 'context-massing') return 1;
      if (object.userData.isFloorLine || object.userData.isFloorLines || object.userData.isFootprint) return 0.34;
      return 0.28;
    }
    if (role === 'facade-glass') return 0.08;
    if (role === 'context-massing') return 0.14;
    if (
      role === 'facade-frame' ||
      role === 'facade-shade' ||
      object.userData.isFloorLine ||
      object.userData.isFloorLines ||
      object.userData.isFootprint
    ) return 0.35;
    return 0.14;
  }

  private shouldIgnore(object: THREE.Object3D): boolean {
    return Boolean(
      object.userData.isGround ||
      object.userData.isDaylightOverlay ||
      object.userData.analysisRole === 'daylight-overlay' ||
      object instanceof THREE.GridHelper ||
      object instanceof THREE.Light ||
      object instanceof THREE.Camera ||
      object instanceof THREE.CameraHelper
    );
  }

  private hasMaterial(object: THREE.Object3D): object is MaterialObject {
    return 'material' in object && Boolean((object as MaterialObject).material);
  }
}
