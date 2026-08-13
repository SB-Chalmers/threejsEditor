import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { resolveOutlineObjects } from '../RendererManager';

describe('resolveOutlineObjects', () => {
  it('returns only the active editable building mass', () => {
    const scene = new THREE.Scene();
    const selected = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    selected.userData = { isBuilding: true, buildingId: 'selected' };
    const other = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    other.userData = { isBuilding: true, buildingId: 'other' };
    const context = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    context.userData = { analysisRole: 'context-massing' };
    const facade = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(),
      new THREE.MeshStandardMaterial(),
      1
    );
    facade.userData = { analysisRole: 'facade-glass' };
    scene.add(selected, other, context, facade);

    expect(resolveOutlineObjects(scene, { kind: 'editing', buildingId: 'selected' })).toEqual([selected]);
    expect(resolveOutlineObjects(scene, { kind: 'normal' })).toEqual([]);
    expect(resolveOutlineObjects(scene, { kind: 'daylight-analysis' })).toEqual([]);
  });
});