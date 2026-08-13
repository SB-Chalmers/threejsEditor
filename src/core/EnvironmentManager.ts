import * as THREE from 'three';
import { getThemeColorAsHex } from '../utils/themeColors';

export interface EnvironmentConfig {
  groundSize?: number;
  groundColor?: number;
  groundOpacity?: number;
  gridSize?: number;
  gridDivisions?: number;
  gridColor?: number;
  gridOpacity?: number; // Add this

  showGrid?: boolean;
}

export class EnvironmentManager {
  private scene: THREE.Scene;
  private config: EnvironmentConfig;
  private groundPlane: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private materials: THREE.Material[] = [];

  constructor(scene: THREE.Scene, config: EnvironmentConfig = {}) {
    this.scene = scene;
    this.config = {
      groundSize: 1000,
      groundColor: getThemeColorAsHex('--color-ground', 0xD3D9DF),
      groundOpacity: 1,
      gridSize: 100,
      gridDivisions: 100,
      gridColor: getThemeColorAsHex('--color-grid-minor', 0xC0C8CF),
      gridOpacity: 0.42,
      showGrid: true,
      ...config
    };
  }

  initialize(): void {
    this.createGroundPlane();
    this.createGrid();
  }

  private createGroundPlane(): void {
    const groundGeometry = new THREE.PlaneGeometry(
      this.config.groundSize!,
      this.config.groundSize!
    );    const groundMaterial = new THREE.MeshStandardMaterial({
      color: this.config.groundColor!,
      transparent: this.config.groundOpacity! < 1,
      opacity: this.config.groundOpacity!,
      roughness: 0.82,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: true,
      alphaTest: this.config.groundOpacity! < 1 ? 0.1 : 0,
      // Add these properties for better shadow reception
      shadowSide: THREE.FrontSide,
      // Control environment map intensity
      envMapIntensity: 0.3
    });
    
    this.materials.push(groundMaterial);
    
    this.groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.y = -0.01;
    this.groundPlane.receiveShadow = true; // This is crucial for shadows
    this.groundPlane.castShadow = false; // Ground shouldn't cast shadows
    this.groundPlane.userData = { isGround: true };
    
    // Ensure the ground plane has proper normals for shadow reception
    groundGeometry.computeVertexNormals();
    
    this.scene.add(this.groundPlane);
    
    console.log('Ground plane created with shadow reception enabled');
  }

  private createGrid(): void {
    const gridColorCenter = new THREE.Color(getThemeColorAsHex('--color-grid-major', 0xA6B0BA));
    const gridColorGrid = new THREE.Color(getThemeColorAsHex('--color-grid-minor', 0xC0C8CF));
    
    this.gridHelper = new THREE.GridHelper(
      this.config.gridSize!,
      this.config.gridDivisions!,
      gridColorCenter,
      gridColorGrid    );
    
    this.gridHelper.position.y = 0.005; // Slightly higher to avoid z-fighting with ground
    this.gridHelper.visible = this.config.showGrid!;
      // Fix material conflicts by properly configuring grid materials
    if (this.gridHelper.material instanceof THREE.LineBasicMaterial) {
      this.gridHelper.material.transparent = true;
      this.gridHelper.material.opacity = this.config.gridOpacity!;
      this.gridHelper.material.depthWrite = false;
      this.gridHelper.material.depthTest = true;
      this.gridHelper.material.fog = false;
      this.materials.push(this.gridHelper.material);
    } else {
      // Handle case when material is an array
      const materials = this.gridHelper.material as THREE.Material[];
      if (Array.isArray(materials)) {
        materials.forEach((material, index) => {
          if (material instanceof THREE.Material) {            material.transparent = true;
            material.opacity = index === 0 ? this.config.gridOpacity! * 1.2 : this.config.gridOpacity!;
            material.depthWrite = false;
            material.depthTest = true;
            // Only set fog property if it's a material that has this property
            if (material instanceof THREE.LineBasicMaterial || 
                material instanceof THREE.MeshBasicMaterial) {
              material.fog = false;
            }
            this.materials.push(material);
          }
        });
      }
    }
    
    this.scene.add(this.gridHelper);
  }

  getGroundPlane(): THREE.Mesh | null {
    return this.groundPlane;
  }

  getGridVisibility(): boolean {
    return this.gridHelper?.visible ?? false;
  }

  toggleGrid(): void {
    if (this.gridHelper) {
      this.gridHelper.visible = !this.gridHelper.visible;
    }
  }

  setGridVisibility(visible: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = visible;
    }
  }

  updateGroundColor(color: number): void {
    if (this.groundPlane && this.groundPlane.material instanceof THREE.MeshStandardMaterial) {
      this.groundPlane.material.color.setHex(color);
    }
  }

  updateGridColor(color: number): void {
    if (this.gridHelper) {
      const newColor = new THREE.Color(color);
      const newColorDark = new THREE.Color(color).multiplyScalar(0.9);
      
      if (Array.isArray(this.gridHelper.material)) {
        this.gridHelper.material[0].color = newColor;
        this.gridHelper.material[1].color = newColorDark;
      }
    }
  }

  updateThemeColors(): void {
    if (this.groundPlane && this.groundPlane.material) {
      const material = this.groundPlane.material as THREE.MeshStandardMaterial;
      material.color.setHex(getThemeColorAsHex('--color-ground', 0xD3D9DF));
      material.roughness = 0.82;
      material.metalness = 0;
      material.emissive.setHex(0x000000);
      material.envMapIntensity = 0.3;
    }

    if (this.gridHelper) {
      this.updateGridColor(getThemeColorAsHex('--color-grid-minor', 0xC0C8CF));
      if (this.gridHelper.material instanceof THREE.Material) {
        const material = this.gridHelper.material as THREE.Material;
        material.opacity = 0.42;
        material.visible = true;
      } else if (Array.isArray(this.gridHelper.material)) {
        (this.gridHelper.material as THREE.Material[]).forEach((mat: THREE.Material) => {
          mat.opacity = 0.42;
          mat.visible = true;
        });
      }
    }

    if (this.scene.fog) {
      (this.scene.fog as THREE.Fog).color.setHex(getThemeColorAsHex('--color-scene-fog', 0xD3D9DF));
      (this.scene.fog as THREE.Fog).near = 500;
      (this.scene.fog as THREE.Fog).far = 1600;
    }
  }

  dispose(): void {
    // Dispose materials
    this.materials.forEach(material => {
      material.dispose();
    });
    this.materials.length = 0;
    
    // Dispose ground plane
    if (this.groundPlane) {
      if (this.groundPlane.geometry) {
        this.groundPlane.geometry.dispose();
      }
      this.scene.remove(this.groundPlane);
      this.groundPlane = null;
    }
    
    // Dispose grid helper
    if (this.gridHelper) {
      if (this.gridHelper.geometry) {
        this.gridHelper.geometry.dispose();
      }
      this.scene.remove(this.gridHelper);
      this.gridHelper = null;
    }
  }
}
