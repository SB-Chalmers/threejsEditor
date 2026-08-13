import * as THREE from 'three';
import { getThemeColorAsHex } from '../utils/themeColors';

export interface SceneConfig {
  backgroundColor?: number;
  enableFog?: boolean;
  fogColor?: number;
  fogNear?: number;
  fogFar?: number;
}

export class SceneManager {
  private scene: THREE.Scene;
  private config: SceneConfig;
  private disposables: THREE.Object3D[] = [];

  constructor(config: SceneConfig = {}) {
    this.config = {
      backgroundColor: getThemeColorAsHex('--color-scene-background', 0xF4F6F8),
      enableFog: false,
      fogColor: getThemeColorAsHex('--color-scene-fog', 0xcccccc),
      fogNear: 1,
      fogFar: 1000,
      ...config
    };
    
    this.scene = this.createScene();
  }

  private createScene(): THREE.Scene {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(this.config.backgroundColor!);
    
    if (this.config.enableFog) {
      scene.fog = new THREE.Fog(
        this.config.fogColor!,
        this.config.fogNear!,
        this.config.fogFar!
      );
    }
    
    return scene;
  }

  getScene(): THREE.Scene {
    return this.scene;
  }

  updateBackgroundColor(color: number): void {
    this.scene.background = new THREE.Color(color);
  }
  // Update scene colors based on current theme
  updateThemeColors(): void {
    const background = getThemeColorAsHex('--color-scene-background', 0xF4F6F8);
    this.scene.background = new THREE.Color(background);
    
    // Update fog color and density if present
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color = new THREE.Color(getThemeColorAsHex('--color-scene-fog', 0xD3D9DF));
      
      // Adjust fog density based on theme
      this.scene.fog.near = 250;
      this.scene.fog.far = 800;
    }
  }

  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
    this.disposables.push(object);
  }

  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
    const index = this.disposables.indexOf(object);
    if (index > -1) {
      this.disposables.splice(index, 1);
    }
  }

  dispose(): void {
    // Dispose all tracked objects
    this.disposables.forEach(object => {
      if (object.parent) {
        object.parent.remove(object);
      }
      
      // Dispose geometry and materials
      if ('geometry' in object) {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) {
          mesh.geometry.dispose();
        }
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(material => material.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
    
    this.disposables.length = 0;
    
    // Clear scene
    this.scene.clear();
    
    // Dispose scene background if it's a texture
    if (this.scene.background instanceof THREE.Texture) {
      this.scene.background.dispose();
    }
    
    // Dispose fog if present
    if (this.scene.fog) {
      this.scene.fog = null;
    }
  }
}
