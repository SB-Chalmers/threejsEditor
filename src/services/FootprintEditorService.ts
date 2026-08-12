import * as THREE from 'three';
import type { Point3D } from '../types/building';

interface FootprintEditorOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  element: HTMLElement;
  points: Point3D[];
  snapToGrid: boolean;
  onChange: (points: Point3D[]) => void;
  onDragStateChange: (dragging: boolean) => void;
}

export const insertFootprintMidpoint = (points: readonly Point3D[], edgeIndex: number): Point3D[] => {
  const next = points[(edgeIndex + 1) % points.length];
  const point = points[edgeIndex];
  const result = points.map(item => ({ ...item }));
  result.splice(edgeIndex + 1, 0, { x: (point.x + next.x) / 2, y: 0, z: (point.z + next.z) / 2 });
  return result;
};

export const deleteFootprintVertex = (points: readonly Point3D[], index: number): Point3D[] =>
  points.length <= 3 ? points.map(point => ({ ...point })) : points.filter((_, pointIndex) => pointIndex !== index).map(point => ({ ...point }));

export const snapFootprintPoint = (point: Point3D, enabled: boolean): Point3D => ({
  x: enabled ? Math.round(point.x) : point.x,
  y: 0,
  z: enabled ? Math.round(point.z) : point.z,
});

export class FootprintEditorService {
  private readonly group = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private points: Point3D[];
  private selectedIndex: number | null = null;
  private draggingIndex: number | null = null;

  constructor(private readonly options: FootprintEditorOptions) {
    this.points = options.points.map(point => ({ ...point, y: 0 }));
    this.group.userData = { isFootprintEditor: true };
    options.scene.add(this.group);
    this.render();
    options.element.addEventListener('pointerdown', this.onPointerDown, true);
    options.element.addEventListener('pointermove', this.onPointerMove, true);
    window.addEventListener('pointerup', this.onPointerUp, true);
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  setPoints(points: Point3D[]): void {
    if (this.draggingIndex !== null) return;
    this.points = points.map(point => ({ ...point, y: 0 }));
    this.render();
  }

  dispose(): void {
    this.options.element.removeEventListener('pointerdown', this.onPointerDown, true);
    this.options.element.removeEventListener('pointermove', this.onPointerMove, true);
    window.removeEventListener('pointerup', this.onPointerUp, true);
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.options.onDragStateChange(false);
    this.group.children.forEach(object => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    });
    this.options.scene.remove(this.group);
  }

  private render(): void {
    while (this.group.children.length > 0) {
      const object = this.group.children.pop();
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    }
    this.points.forEach((point, index) => {
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 16, 12),
        new THREE.MeshStandardMaterial({ color: this.selectedIndex === index ? 0x2563EB : 0xF8FAFC, roughness: 0.75, metalness: 0 })
      );
      handle.position.set(point.x, 0.2, point.z);
      handle.userData = { footprintHandle: 'vertex', index };
      handle.renderOrder = 5;
      this.group.add(handle);

      const next = this.points[(index + 1) % this.points.length];
      const midpoint = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 8),
        new THREE.MeshStandardMaterial({ color: 0x93C5FD, roughness: 0.8, metalness: 0 })
      );
      midpoint.position.set((point.x + next.x) / 2, 0.16, (point.z + next.z) / 2);
      midpoint.userData = { footprintHandle: 'midpoint', index };
      this.group.add(midpoint);
    });
  }

  private setPointer(event: PointerEvent) {
    const rect = this.options.element.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.options.camera);
  }

  private onPointerDown = (event: PointerEvent) => {
    this.setPointer(event);
    const hit = this.raycaster.intersectObjects(this.group.children, false)[0]?.object;
    if (!hit) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const type = hit.userData.footprintHandle as 'vertex' | 'midpoint';
    const index = Number(hit.userData.index);
    if (type === 'midpoint') {
      this.points = insertFootprintMidpoint(this.points, index);
      this.draggingIndex = index + 1;
      this.selectedIndex = index + 1;
      this.emit();
    } else {
      this.draggingIndex = index;
      this.selectedIndex = index;
      this.render();
    }
    this.options.onDragStateChange(true);
    this.options.element.setPointerCapture?.(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.draggingIndex === null) return;
    event.preventDefault();
    this.setPointer(event);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return;
    this.points[this.draggingIndex] = snapFootprintPoint({ x: hit.x, y: 0, z: hit.z }, this.options.snapToGrid);
    this.emit();
  };

  private onPointerUp = () => {
    if (this.draggingIndex === null) return;
    this.draggingIndex = null;
    this.options.onDragStateChange(false);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if ((event.key !== 'Delete' && event.key !== 'Backspace') || this.selectedIndex === null || this.points.length <= 3) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.points = deleteFootprintVertex(this.points, this.selectedIndex);
    this.selectedIndex = Math.min(this.selectedIndex, this.points.length - 1);
    this.emit();
  };

  private emit(): void {
    this.render();
    this.options.onChange(this.points.map(point => ({ ...point })));
  }
}
