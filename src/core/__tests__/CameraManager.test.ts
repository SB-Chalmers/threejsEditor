import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { CameraManager } from '../CameraManager';
const setup = () => {
  const manager = new CameraManager(1.5);
  const controls = { target: new THREE.Vector3(10,0,-3), object: manager.getCamera(), enabled: true, enableRotate: true, mouseButtons: {}, update: vi.fn(), dispose: vi.fn() };
  Object.assign(manager, { controls });
  return { manager, controls };
};
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>vi.useRealTimers());
describe('plan-first camera ownership',()=>{
  it('restores the previous 3D position and target after plan editing',()=>{
    const {manager,controls}=setup();
    const position=manager.getCamera().position.clone(), target=controls.target.clone();
    manager.setPlanMode(true);vi.advanceTimersByTime(300);manager.update();
    expect(manager.getCurrentCameraType()).toBe('orthographic');
    expect(manager.getCamera().position.x).toBeCloseTo(target.x);
    expect(controls.enableRotate).toBe(false);
    manager.setPlanMode(false);vi.advanceTimersByTime(300);manager.update();
    expect(manager.getCurrentCameraType()).toBe('perspective');
    expect(manager.getCamera().position.distanceTo(position)).toBeLessThan(1e-8);
    expect(controls.target.distanceTo(target)).toBeLessThan(1e-8);
    expect(controls.enableRotate).toBe(true);
  });
  it('stops camera animation during a gesture and preserves plan framing on fit and resize',()=>{
    const {manager,controls}=setup();
    manager.setPlanMode(true);manager.setControlsEnabled(false);
    const position=manager.getCamera().position.clone();vi.advanceTimersByTime(500);manager.update();
    expect(manager.getCamera().position.equals(position)).toBe(true);
    manager.setControlsEnabled(true);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(10,20,8));mesh.position.set(40,10,-10);mesh.updateMatrixWorld();
    manager.fitToObjects([mesh],{duration:100});vi.advanceTimersByTime(120);manager.update();
    expect(manager.getCamera().position.x).toBeCloseTo(40);
    expect(manager.getCamera().position.z).toBeCloseTo(-10,3);
    expect(controls.target.y).toBe(0);
    const top=manager.getOrthographicCamera().top;
    manager.updateAspect(.7);expect(manager.getOrthographicCamera().top).toBe(top);
    expect(manager.getOrthographicCamera().right).toBeCloseTo(top*.7);
  });
});
