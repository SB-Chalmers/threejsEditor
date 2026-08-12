import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { SceneAppearanceManager } from '../SceneAppearanceManager';

const mesh = (role?: string): THREE.Mesh => {
  const result = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x4488cc })
  );
  result.castShadow = true;
  result.receiveShadow = true;
  if (role) result.userData.analysisRole = role;
  return result;
};

describe('SceneAppearanceManager', () => {
  it('applies role-specific daylight ghosting while leaving overlay, ground, and grid unchanged', () => {
    const scene = new THREE.Scene();
    const building = mesh();
    const glass = mesh('facade-glass');
    const frame = mesh('facade-frame');
    const shade = mesh('facade-shade');
    const overlay = mesh('daylight-overlay');
    overlay.userData.isDaylightOverlay = true;
    const ground = mesh();
    ground.userData.isGround = true;
    const grid = new THREE.GridHelper();
    scene.add(building, glass, frame, shade, overlay, ground, grid);
    const originals = [building, glass, frame, shade, overlay, ground]
      .map((object) => object.material);
    const manager = new SceneAppearanceManager();

    manager.setMode(scene, { kind: 'daylight-analysis' });

    expect((building.material as THREE.Material).opacity).toBeCloseTo(0.14);
    expect((glass.material as THREE.Material).opacity).toBeCloseTo(0.08);
    expect((frame.material as THREE.Material).opacity).toBeCloseTo(0.35);
    expect((shade.material as THREE.Material).opacity).toBeCloseTo(0.35);
    expect((building.material as THREE.Material).depthTest).toBe(true);
    expect((building.material as THREE.Material).depthWrite).toBe(false);
    expect(building.castShadow).toBe(false);
    expect(overlay.material).toBe(originals[4]);
    expect(ground.material).toBe(originals[5]);
  });

  it('restores exact materials and shadow flags across mutually exclusive modes', () => {
    const scene = new THREE.Scene();
    const focused = mesh();
    focused.userData.buildingId = 'a';
    const context = mesh();
    context.userData.buildingId = 'b';
    scene.add(focused, context);
    const focusedMaterial = focused.material;
    const contextMaterial = context.material;
    const manager = new SceneAppearanceManager();

    manager.setMode(scene, { kind: 'daylight-analysis' });
    manager.setMode(scene, { kind: 'editing', buildingId: 'a' });
    expect(focused.material).toBe(focusedMaterial);
    expect(context.material).not.toBe(contextMaterial);
    expect((context.material as THREE.Material).opacity).toBeCloseTo(0.14);

    manager.setMode(scene, { kind: 'normal' });
    expect(focused.material).toBe(focusedMaterial);
    expect(context.material).toBe(contextMaterial);
    expect(focused.castShadow).toBe(true);
    expect(context.castShadow).toBe(true);
    expect(manager.currentMode).toEqual({ kind: 'normal' });
  });
});
