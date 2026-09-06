import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type CameraType = 'perspective' | 'orthographic';
export type CameraView = 'perspective' | 'top' | 'front' | 'bottom' | 'left' | 'right' | 'northeast' | 'southeast' | 'southwest' | 'northwest';

export interface CameraConfig {
  fov?: number;
  near?: number;
  far?: number;
  position?: { x: number; y: number; z: number };
  target?: { x: number; y: number; z: number };
  orthographicSize?: number;
}

export interface ViewTransitionOptions {
  duration?: number;
  easing?: (t: number) => number;
  onComplete?: () => void;
}

export class CameraManager {
  private perspectiveCamera: THREE.PerspectiveCamera;
  private orthographicCamera: THREE.OrthographicCamera;
  private currentCameraType: CameraType = 'perspective';
  private controls: OrbitControls | null = null;
  private config: CameraConfig;
  private aspect: number;
  private planMode = false;
  private saved3D: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;

  setSpacePan(active: boolean): void {
    if (this.controls) this.controls.mouseButtons.LEFT = active ? THREE.MOUSE.PAN : undefined;
  }

  setPlanMode(plan: boolean): void {
    if (!this.controls) return;
    this.planMode = plan;
    if (plan) {
      if (this.currentCameraType === 'perspective') this.saved3D = {
        position: this.getCurrentCamera().position.clone(), target: this.controls.target.clone(),
      };
      const target = this.controls.target.clone();
      target.y = 0;
      const distance = Math.max(40, this.getCurrentCamera().position.distanceTo(target));
      this.switchCameraType('orthographic');
      this.controls.enableRotate = false;
      this.transitionToView(target.clone().add(new THREE.Vector3(0, distance, 0.0001)), target, { duration: 280 });
    } else {
      this.switchCameraType('perspective');
      this.controls.enableRotate = true;
      this.transitionToView(this.saved3D?.position ?? new THREE.Vector3(45, 45, 45),
        this.saved3D?.target ?? new THREE.Vector3(), { duration: 280 });
    }
  }
  
  // Transition system
  private isTransitioning = false;
  private transitionStartTime = 0;
  private transitionDuration = 1000;
  private transitionEasing = this.easeInOutCubic;
  private fromPosition = new THREE.Vector3();
  private toPosition = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private onTransitionComplete?: () => void;

  constructor(aspect: number, config: CameraConfig = {}) {
    this.aspect = aspect;
    this.config = {
      fov: 35,
      near: 0.1,
      far: 1000,
      position: { x: 45, y: 45, z: 45 },
      target: { x: 0, y: 0, z: 0 },
      orthographicSize: 50,
      ...config
    };
    
    this.perspectiveCamera = this.createPerspectiveCamera(aspect);
    this.orthographicCamera = this.createOrthographicCamera(aspect);
  }

  private createPerspectiveCamera(aspect: number): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
      this.config.fov!,
      aspect,
      this.config.near!,
      this.config.far!
    );
    
    camera.position.set(
      this.config.position!.x,
      this.config.position!.y,
      this.config.position!.z
    );
    
    return camera;
  }

  private createOrthographicCamera(aspect: number): THREE.OrthographicCamera {
    const size = this.config.orthographicSize!;
    const camera = new THREE.OrthographicCamera(
      -size * aspect,
      size * aspect,
      size,
      -size,
      this.config.near!,
      this.config.far!
    );
    
    camera.position.set(
      this.config.position!.x,
      this.config.position!.y,
      this.config.position!.z
    );
    
    return camera;
  }

  async initializeControls(renderer: THREE.WebGLRenderer): Promise<void> {
    try {
      const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
      
      this.controls = new OrbitControls(this.getCurrentCamera(), renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxPolarAngle = Math.PI / 2.1;
      this.controls.minDistance = 10;
      this.controls.maxDistance = 800;
      this.controls.enablePan = true;
      this.controls.mouseButtons = { LEFT: undefined, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
      this.controls.panSpeed = 0.8;
      this.controls.rotateSpeed = 0.4;
      this.controls.zoomSpeed = 0.6;
      
      // Set target to config target
      this.controls.target.set(
        this.config.target!.x,
        this.config.target!.y,
        this.config.target!.z
      );
      this.controls.update();
      
    } catch (error) {
      console.error('Failed to initialize camera controls:', error);
      throw error;
    }
  }

  getCurrentCamera(): THREE.Camera {
    return this.currentCameraType === 'perspective' ? this.perspectiveCamera : this.orthographicCamera;
  }

  getPerspectiveCamera(): THREE.PerspectiveCamera {
    return this.perspectiveCamera;
  }

  getOrthographicCamera(): THREE.OrthographicCamera {
    return this.orthographicCamera;
  }

  // Legacy method for backward compatibility
  getCamera(): THREE.Camera {
    return this.getCurrentCamera();
  }

  getControls(): OrbitControls | null {
    return this.controls;
  }

  setControlsEnabled(enabled: boolean): void {
    if (this.controls) {
      if (!enabled) this.isTransitioning = false;
      this.controls.enabled = enabled;
    }
  }

  getCurrentCameraType(): CameraType {
    return this.currentCameraType;
  }

  switchCameraType(type: CameraType): void {
    if (this.currentCameraType === type || !this.controls) return;

    console.log(`Switching camera type from ${this.currentCameraType} to ${type}`);

    // Store current position and target before switching
    const currentCamera = this.getCurrentCamera();
    const currentPosition = currentCamera.position.clone();
    const currentTarget = this.controls.target.clone();

    // Switch camera type
    this.currentCameraType = type;
    const newCamera = this.getCurrentCamera();

    // Apply stored position to new camera
    newCamera.position.copy(currentPosition);
    
    // Handle orthographic-specific adjustments BEFORE updating controls
    if (type === 'orthographic') {
      this.syncOrthographicZoom();
    }
    
    // Update the camera's look direction
    newCamera.lookAt(currentTarget);
    newCamera.updateMatrixWorld();

    // Update controls to use new camera - this is crucial
    this.controls.object = newCamera;
    this.controls.target.copy(currentTarget);
    
    // Force controls update
    this.controls.update();
    
    console.log(`Camera switched to ${type} successfully`);
    console.log(`New camera position:`, newCamera.position);
    console.log(`New camera target:`, this.controls.target);
  }

  private syncOrthographicZoom(): void {
    if (!this.controls) return;
    
    // Calculate appropriate orthographic size based on camera distance
    const distance = this.controls.object.position.distanceTo(this.controls.target);
    const size = Math.max(distance * 0.3, 25); // Adjusted for better visibility
    
    this.orthographicCamera.left = -size * this.aspect;
    this.orthographicCamera.right = size * this.aspect;
    this.orthographicCamera.top = size;
    this.orthographicCamera.bottom = -size;
    this.orthographicCamera.updateProjectionMatrix();
    
    console.log(`Orthographic zoom synced: size=${size}, distance=${distance}`);
  }

  setCameraView(view: CameraView, options: ViewTransitionOptions = {}): void {
    if (!this.controls) {
      console.warn('Cannot set camera view - controls not initialized');
      return;
    }

    console.log(`Setting camera view to: ${view}`);

    // Handle special case for perspective view
    if (view === 'perspective') {
      // Switch to perspective camera first
      if (this.currentCameraType !== 'perspective') {
        this.switchCameraType('perspective');
      }
      this.transitionToView(
        new THREE.Vector3(45, 45, 45),
        new THREE.Vector3(0, 0, 0),
        options
      );
      return;
    }

    // For all other views, use orthographic camera
    if (this.currentCameraType !== 'orthographic') {
      this.switchCameraType('orthographic');
    }
    
    // Set appropriate orthographic size for the view - do this BEFORE transition
    const size = 40; // Fixed size for orthographic views
    this.orthographicCamera.left = -size * this.aspect;
    this.orthographicCamera.right = size * this.aspect;
    this.orthographicCamera.top = size;
    this.orthographicCamera.bottom = -size;
    this.orthographicCamera.updateProjectionMatrix();
    
    const position = this.getViewPosition(view);
    const target = new THREE.Vector3(0, 0, 0);
    
    // For orthographic views, we want immediate positioning, not smooth transitions
    // This ensures the view actually changes
    this.setImmediateView(position, target);
  }

  private getViewPosition(view: CameraView): THREE.Vector3 {
    const distance = 80; // Distance for orthographic views
    
    const positions: Record<CameraView, THREE.Vector3> = {
      perspective: new THREE.Vector3(45, 45, 45),
      top: new THREE.Vector3(0, distance, 0),
      bottom: new THREE.Vector3(0, -distance, 0),
      front: new THREE.Vector3(0, 0, distance),
      left: new THREE.Vector3(-distance, 0, 0),
      right: new THREE.Vector3(distance, 0, 0),
      northeast: new THREE.Vector3(distance * 0.7, distance * 0.7, distance * 0.7),
      southeast: new THREE.Vector3(distance * 0.7, distance * 0.7, -distance * 0.7),
      southwest: new THREE.Vector3(-distance * 0.7, distance * 0.7, -distance * 0.7),
      northwest: new THREE.Vector3(-distance * 0.7, distance * 0.7, distance * 0.7),
    };

    return positions[view] || positions.perspective;
  }

  // New method for immediate view changes (no transition)
  private setImmediateView(targetPosition: THREE.Vector3, targetTarget: THREE.Vector3): void {
    if (!this.controls) return;
    
    // Cancel any ongoing transition
    this.isTransitioning = false;
    
    const currentCamera = this.getCurrentCamera();
    
    // Set position and target immediately
    currentCamera.position.copy(targetPosition);
    this.controls.target.copy(targetTarget);
    
    // Update camera orientation
    currentCamera.lookAt(targetTarget);
    currentCamera.updateMatrixWorld();
    
    // Force update the projection matrix for orthographic cameras
    if (currentCamera instanceof THREE.OrthographicCamera) {
      currentCamera.updateProjectionMatrix();
    }
    
    // Update controls and force immediate update
    this.controls.update();
    
    // Force one more matrix update to ensure everything is synchronized
    currentCamera.updateMatrixWorld(true);
    
    console.log(`Immediate view set - Position: ${targetPosition.x}, ${targetPosition.y}, ${targetPosition.z}`);
    console.log(`Immediate view set - Target: ${targetTarget.x}, ${targetTarget.y}, ${targetTarget.z}`);
    console.log(`Camera type: ${this.currentCameraType}`);
    console.log(`Camera matrix updated: ${currentCamera.matrixWorldNeedsUpdate}`);
  }

  private transitionToView(
    targetPosition: THREE.Vector3,
    targetTarget: THREE.Vector3,
    options: ViewTransitionOptions = {}
  ): void {
    if (!this.controls) {
      console.warn('Cannot transition view - controls not initialized');
      return;
    }
    
    if (this.isTransitioning) {
      console.log('Cancelling previous transition');
      this.isTransitioning = false;
    }

    const {
      duration = 800, // Shorter duration for snappier transitions
      easing = this.easeInOutCubic,
      onComplete
    } = options;

    // Store transition parameters
    this.fromPosition.copy(this.getCurrentCamera().position);
    this.toPosition.copy(targetPosition);
    this.fromTarget.copy(this.controls.target);
    this.toTarget.copy(targetTarget);
    
    this.transitionDuration = duration;
    this.transitionEasing = easing;
    this.onTransitionComplete = onComplete;
    
    // Start transition
    this.isTransitioning = true;
    this.transitionStartTime = performance.now();
    
    console.log(`Starting camera transition from: ${this.fromPosition.x.toFixed(2)}, ${this.fromPosition.y.toFixed(2)}, ${this.fromPosition.z.toFixed(2)}`);
    console.log(`Starting camera transition to: ${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)}`);
  }

  fitToObjects(objects: THREE.Object3D[], options: ViewTransitionOptions = {}): void {
    if (objects.length === 0 || !this.controls) return;

    // Calculate bounding box of all objects
    const box = new THREE.Box3();
    objects.forEach(obj => {
      const objBox = new THREE.Box3().setFromObject(obj);
      box.union(objBox);
    });

    if (box.isEmpty()) return;

    // Calculate optimal camera position and target
    const center = box.getCenter(new THREE.Vector3());
    if (this.planMode) center.y = 0;
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);

    // Calculate distance based on camera type
    let distance: number;
    if (this.currentCameraType === 'perspective') {
      const verticalFov = THREE.MathUtils.degToRad(this.perspectiveCamera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.aspect);
      const horizontalSize = Math.max(size.x, size.z);
      const verticalDistance = size.y / (2 * Math.tan(verticalFov / 2));
      const horizontalDistance = horizontalSize / (2 * Math.tan(horizontalFov / 2));
      distance = Math.max(verticalDistance, horizontalDistance) * 1.8 + horizontalSize * 0.5;
    } else {
      distance = maxDimension * 1.1;
      
      // Update orthographic camera size
      const viewSize = this.planMode ? Math.max(size.z, size.x / this.aspect) * 0.6 : maxDimension * 0.56;
      this.orthographicCamera.left = -viewSize * this.aspect;
      this.orthographicCamera.right = viewSize * this.aspect;
      this.orthographicCamera.top = viewSize;
      this.orthographicCamera.bottom = -viewSize;
      this.orthographicCamera.updateProjectionMatrix();
    }

    // Position camera to look at center from current direction
    const direction = new THREE.Vector3();
    if (this.planMode) direction.set(0, 1, 0.000001).normalize();
    else direction.subVectors(this.getCurrentCamera().position, center).normalize();
    if (this.planMode) distance = Math.max(size.y + 20, 80);
    const targetPosition = center.clone().add(direction.multiplyScalar(distance));

    this.transitionToView(targetPosition, center, options);
  }

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  updateAspect(aspect: number): void {
    this.aspect = aspect;
    
    // Update perspective camera
    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();
    
    // Update orthographic camera
    const size = this.orthographicCamera.top;
    this.orthographicCamera.left = -size * aspect;
    this.orthographicCamera.right = size * aspect;
    this.orthographicCamera.updateProjectionMatrix();
  }

  update(): void {
    // Handle view transitions
    if (this.isTransitioning) {
      const now = performance.now();
      const elapsed = now - this.transitionStartTime;
      const progress = Math.min(elapsed / this.transitionDuration, 1);
      const easedProgress = this.transitionEasing(progress);

      // Interpolate camera position and target
      const currentCamera = this.getCurrentCamera();
      currentCamera.position.lerpVectors(this.fromPosition, this.toPosition, easedProgress);
      
      if (this.controls) {
        this.controls.target.lerpVectors(this.fromTarget, this.toTarget, easedProgress);
      }

      // Update camera orientation and matrix
      currentCamera.lookAt(this.controls!.target);
      currentCamera.updateMatrixWorld();
      
      // Update controls
      if (this.controls) {
        this.controls.update();
      }

      // Log progress for debugging
      if (progress === 1 || elapsed % 200 < 16) { // Log every ~200ms or at completion
        console.log(`Transition progress: ${(progress * 100).toFixed(1)}%`, 
          `Position: ${currentCamera.position.x.toFixed(2)}, ${currentCamera.position.y.toFixed(2)}, ${currentCamera.position.z.toFixed(2)}`);
      }

      // Check if transition is complete
      if (progress >= 1) {
        this.isTransitioning = false;
        console.log('Camera transition completed');
        console.log(`Final position: ${currentCamera.position.x.toFixed(2)}, ${currentCamera.position.y.toFixed(2)}, ${currentCamera.position.z.toFixed(2)}`);
        console.log(`Final target: ${this.controls?.target.x.toFixed(2)}, ${this.controls?.target.y.toFixed(2)}, ${this.controls?.target.z.toFixed(2)}`);
        
        if (this.onTransitionComplete) {
          this.onTransitionComplete();
          this.onTransitionComplete = undefined;
        }
      }
    }
    
    // Update controls (always update, but transitions take precedence)
    if (this.controls?.enabled) {
      this.controls.update();
    }
  }

  dispose(): void {
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
  }
}
