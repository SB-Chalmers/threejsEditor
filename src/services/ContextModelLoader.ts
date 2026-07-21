import * as THREE from 'three';
import { Rhino3dmLoader } from 'three/examples/jsm/loaders/3DMLoader.js';
import { SceneManager } from '../core/SceneManager';
import { getThemeColorAsHex } from '../utils/themeColors';

export class ContextModelLoader {
  private sceneManager: SceneManager;
  private modelPath: string;
  private contextMesh: THREE.Object3D | null = null;

  constructor(sceneManager: SceneManager, modelPath: string = `${import.meta.env.BASE_URL}model/context.3dm`) {
    this.sceneManager = sceneManager;
    this.modelPath = modelPath;
  }

  async loadContextModel(): Promise<THREE.Object3D | null> {
    try {
      const loader = new Rhino3dmLoader();
      // Use CDN path for rhino3dm wasm file
      loader.setLibraryPath('https://cdn.jsdelivr.net/npm/rhino3dm@8.17.0/');

      return new Promise((resolve, reject) => {
        loader.load(
          this.modelPath,
          (object) => {            // Set properties for all meshes in the loaded model
            object.traverse((child) => {
              // Set all objects to receive shadows but not cast them
              child.receiveShadow = true;
              child.castShadow = true;
                if (child instanceof THREE.Mesh) {                // Apply a light grey matte material
                child.material = new THREE.MeshStandardMaterial({
                  color: getThemeColorAsHex('--color-context-model', 0xffffff), // Use CSS variable
                  roughness: 0.8,
                  metalness: 0.0,
                });
                
                // Make the mesh not clickable or interactive
                child.userData.isContextMesh = true;
                child.userData.nonInteractive = true;
                
                // Ensure it receives shadows but doesn't cast them (already set above, but being explicit)
                child.receiveShadow = true;
                child.castShadow = true;
                
                // Swap Y and Z coordinates to convert from Rhino's Z-up to Three.js Y-up
                child.traverse((subChild) => {
                  if (subChild instanceof THREE.Mesh && subChild.geometry) {
                    const position = subChild.geometry.attributes.position;
                    const array = position.array;
                    
                    // Swap Y and Z for each vertex
                    for (let i = 0; i < array.length; i += 3) {
                      const y = array[i + 1];
                      array[i + 1] = array[i + 2];
                      array[i + 2] = -y; // Negate to preserve handedness
                    }
                    
                    position.needsUpdate = true;
                  }
                });
              }
            });            // Store reference to the mesh for theme updates
            this.contextMesh = object;
              
            // Apply current theme colors
            const isDarkTheme = document.documentElement.classList.contains('dark-theme');
            const contextColor = getThemeColorAsHex(
              '--color-context-model', 
              isDarkTheme ? 0x8a8a8a : 0xffffff
            );
              
            // Apply colors to all meshes
            object.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material && 'color' in child.material) {
                (child.material as THREE.MeshStandardMaterial).color.setHex(contextColor);
              }
            });
              
            // Add to scene
            this.sceneManager.addObject(object);
            console.log('Context model loaded with', isDarkTheme ? 'dark' : 'light', 'theme colors');
              
            // Return the loaded object
            resolve(object);
          },
          (xhr) => {
            // Progress callback
            console.log((xhr.loaded / xhr.total) * 100 + '% loaded');
          },
          (error) => {
            // Error callback
            console.error('Error loading context model:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Failed to load context model:', error);
      return null;
    }
  }

  getContextMesh(): THREE.Object3D | null {
    return this.contextMesh;
  }

  dispose(): void {
    if (this.contextMesh) {
      this.sceneManager.removeObject(this.contextMesh);
      this.contextMesh = null;
    }
  }
  
  /**
   * Updates the context model colors based on current theme
   */
  updateThemeColors(): void {
    if (!this.contextMesh) return;
    
    const isDarkTheme = document.documentElement.classList.contains('dark-theme');
    const contextColor = getThemeColorAsHex(
      '--color-context-model', 
      isDarkTheme ? 0x8a8a8a : 0xffffff
    );
    
    // Update all mesh materials in the context model
    this.contextMesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (child.material instanceof THREE.Material) {
          // For single materials
          if ('color' in child.material) {
            (child.material as THREE.MeshStandardMaterial).color.setHex(contextColor);
          }
        } else if (Array.isArray(child.material)) {
          // For multiple materials
          child.material.forEach(mat => {
            if ('color' in mat) {
              (mat as THREE.MeshStandardMaterial).color.setHex(contextColor);
            }
          });
        }
      }
    });
  }
}
