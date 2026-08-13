import * as THREE from 'three';
import type { Sky } from 'three/examples/jsm/objects/Sky.js';
import { getThemeColorAsHex, getThemeColorAsThreeColor } from '../utils/themeColors';
import { getCurrentSunPosition, getSunIntensity, getAmbientIntensity, type SunPosition } from '../utils/sunPosition';

export interface LightingConfig {
  sunLightColor?: number;
  sunLightIntensity?: number;
  sunPosition?: { x: number; y: number; z: number };
  enableShadows?: boolean;
  shadowMapSize?: number;
  shadowCameraBounds?: number;
  enableSky?: boolean;
  useRealisticSun?: boolean; // New option for realistic sun positioning
}

export class LightingManager {
  private scene: THREE.Scene;
  private config: LightingConfig;
  private sun: THREE.DirectionalLight | null = null;
  private ambient: THREE.AmbientLight | null = null; // Add ambient light
  private hemiLight: THREE.HemisphereLight | null = null; // Add hemisphere light for better ambient light
  private shadowHelper: THREE.CameraHelper | null = null;
  private sky: Sky | null = null;
  private needsShadowUpdate = false;
  private currentSunPosition: SunPosition | null = null; // Track current realistic sun position
  private isUsingRealisticSun = false; // Track if we're using realistic positioning
  constructor(scene: THREE.Scene, config: LightingConfig = {}) {
    this.scene = scene;
    this.config = {      // This will be loaded from CSS variable at runtime
      sunLightColor: getThemeColorAsHex('--color-sun-light', 0xfaf6ed),
      sunLightIntensity: 1.8, // Slightly reduced intensity
      sunPosition: { x: 75, y: 115, z: 65 },
      enableShadows: true,
      shadowMapSize: 2048, // Increased for better shadow quality
      shadowCameraBounds: 30,
      enableSky: true,
      useRealisticSun: false, // Default to manual positioning
      ...config
    };
  }async initialize(): Promise<void> {
    try {
      // Create basic lights first to ensure they're available
      this.createSunLight();
      this.createAmbientLight();
      this.createHemisphereLight();
      
      // Then try to create the sky, but don't let failure stop initialization
      if (this.config.enableSky) {
        try {
          await this.createSky();
        } catch (skyError) {
          console.warn('Sky creation failed, continuing without sky:', skyError);
          // Continue without sky - this is not critical
        }
      }
      
      console.log('Lighting system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize core lighting components:', error);
      throw error;
    }
  }
  
  private createAmbientLight(): void {    // Create subtle ambient light for softer shadows
    // Using CSS variable color via our utility function
    const ambientColor = getThemeColorAsHex('--color-ambient-light', 0xffffff);
    this.ambient = new THREE.AmbientLight(ambientColor, 0.28);
    this.scene.add(this.ambient);
  }
    private createHemisphereLight(): void {
    // Create hemisphere light for better ambient illumination
    // Using CSS variable colors via our utility function
    const skyColor = getThemeColorAsHex('--color-hemisphere-sky', 0x77a0d5);
    const groundColor = getThemeColorAsHex('--color-hemisphere-ground', 0xbcaf70);
    
    // Debug info - remove in production
    console.log('Creating hemisphere light with colors:', {
      skyColorVar: '--color-hemisphere-sky',
      skyColorHex: '0x' + skyColor.toString(16),
      groundColorVar: '--color-hemisphere-ground',
      groundColorHex: '0x' + groundColor.toString(16)
    });
    
    this.hemiLight = new THREE.HemisphereLight(skyColor, groundColor, 0.30);
    this.scene.add(this.hemiLight);
  }

  private createSunLight(): void {
    this.sun = new THREE.DirectionalLight(
      this.config.sunLightColor!,
      this.config.sunLightIntensity!
    );
    
    this.sun.position.set(
      this.config.sunPosition!.x,
      this.config.sunPosition!.y,
      this.config.sunPosition!.z
    );
    
    if (this.config.enableShadows) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.width = this.config.shadowMapSize!;
      this.sun.shadow.mapSize.height = this.config.shadowMapSize!;
      
      // Improved shadow camera configuration
      this.sun.shadow.camera.near = 0.5;
      this.sun.shadow.camera.far = 500;
      
      const bounds = this.config.shadowCameraBounds!;
      this.sun.shadow.camera.left = -bounds;
      this.sun.shadow.camera.right = bounds;
      this.sun.shadow.camera.top = bounds;
      this.sun.shadow.camera.bottom = -bounds;
        // Better shadow quality settings - adjusted for softer shadows
      this.sun.shadow.radius = 4;
      this.sun.shadow.blurSamples = 16;
      this.sun.shadow.bias = -0.00008;
      this.sun.shadow.normalBias = 0.035;
      
      // Position the shadow camera target at the scene center
      this.sun.target.position.set(0, 0, 0);
      this.scene.add(this.sun.target);
      
      this.shadowHelper = new THREE.CameraHelper(this.sun.shadow.camera);
      this.shadowHelper.visible = false;
      this.scene.add(this.shadowHelper);
    }
    
    this.scene.add(this.sun);
  }  private async createSky(): Promise<void> {
    try {
      const { Sky } = await import('three/examples/jsm/objects/Sky.js');
      this.sky = new Sky();
      this.sky.scale.setScalar(10000);
      
      // First add it to the scene to ensure it's properly initialized
      this.scene.add(this.sky);
      
      // Add a slight delay to ensure the Sky object is fully initialized
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Initialize uniforms safely after Sky is added to scene 
      this.initializeSkyUniforms();
      
      console.log('Sky created successfully');
    } catch (error) {
      console.error('Failed to create sky:', error);
      this.sky = null;
    }
  }
  
  private initializeSkyUniforms(): void {
    if (!this.sky || !this.sky.material || !this.sky.material.uniforms) {
      console.warn('Sky uniforms not available');
      return;
    }
    
    try {
      const isDarkTheme = document.documentElement.classList.contains('dark-theme');
      const uniforms = this.sky.material.uniforms;
      
      // Check if each uniform exists before setting
      if ('turbidity' in uniforms) {
        uniforms['turbidity'].value = isDarkTheme ? 10 : 10;
      }
      
      if ('rayleigh' in uniforms) {
        uniforms['rayleigh'].value = isDarkTheme ? 2 : 1;
      }
      
      if ('mieCoefficient' in uniforms) {
        uniforms['mieCoefficient'].value = 0.005;
      }
      
      if ('mieDirectionalG' in uniforms) {
        uniforms['mieDirectionalG'].value = isDarkTheme ? 0.7 : 0.8;
      }
      
      if ('luminance' in uniforms) {
        uniforms['luminance'].value = isDarkTheme ? 0.5 : 1.0;
      }
      
      // Initialize sun position if available
      if (this.sun && 'sunPosition' in uniforms) {
        const sunPosition = new THREE.Vector3();
        sunPosition.copy(this.sun.position).normalize();
        uniforms['sunPosition'].value.copy(sunPosition);
      }
      
      console.log(`Sky uniforms initialized with ${isDarkTheme ? 'night' : 'day'} settings`);
    } catch (error) {
      console.error('Error initializing sky uniforms:', error);
    }
  }  private updateSkyUniforms(): void {
    // Check if sky and sun are available
    if (!this.sky || !this.sun || !this.sky.material || !this.sky.material.uniforms) {
      return;
    }
    
    try {
      const uniforms = this.sky.material.uniforms;
      const isDarkTheme = document.documentElement.classList.contains('dark-theme');
      
      // Update sun position if that uniform exists
      if (this.sun && 'sunPosition' in uniforms && uniforms['sunPosition']?.value) {
        const sunPosition = new THREE.Vector3();
        sunPosition.copy(this.sun.position).normalize();
        uniforms['sunPosition'].value.copy(sunPosition);
      }
      
      // Only update uniforms that exist
      if (isDarkTheme) {
        // Night sky settings - with safety checks
        if ('turbidity' in uniforms) uniforms['turbidity'].value = 10;
        if ('rayleigh' in uniforms) uniforms['rayleigh'].value = 2;
        if ('mieCoefficient' in uniforms) uniforms['mieCoefficient'].value = 0.005;
        if ('mieDirectionalG' in uniforms) uniforms['mieDirectionalG'].value = 0.7;
        if ('luminance' in uniforms) uniforms['luminance'].value = 0.5;
      } else {
        // Day sky settings - with safety checks
        if ('turbidity' in uniforms) uniforms['turbidity'].value = 10;
        if ('rayleigh' in uniforms) uniforms['rayleigh'].value = 1;
        if ('mieCoefficient' in uniforms) uniforms['mieCoefficient'].value = 0.005;
        if ('mieDirectionalG' in uniforms) uniforms['mieDirectionalG'].value = 0.8;
        if ('luminance' in uniforms) uniforms['luminance'].value = 1.0;
      }
    } catch (error) {
      console.error('Error updating sky uniforms:', error);
    }
  }

  toggleShadowHelper(): void {
    if (this.shadowHelper) {
      this.shadowHelper.visible = !this.shadowHelper.visible;
    }
  }

  updateShadowQuality(quality: 'low' | 'medium' | 'high' | 'ultra'): void {
    if (!this.sun || !this.sun.shadow) return;
    
    const settings = {
      'low': { size: 1024, radius: 2.5 },
      'medium': { size: 2048, radius: 1.5 },
      'high': { size: 4096, radius: 1 },
      'ultra': { size: 8192, radius: 0.5 }
    }[quality];
    
    // Properly update shadow map size
    const currentSize = this.sun.shadow.mapSize;
    if (currentSize.width !== settings.size || currentSize.height !== settings.size) {
      // Dispose old shadow map
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
      
      // Update size
      this.sun.shadow.mapSize.setScalar(settings.size);
      this.sun.shadow.radius = settings.radius;
      
      // Mark for shadow camera update
      this.needsShadowUpdate = true;
    }
    
    if (this.shadowHelper && this.needsShadowUpdate) {
      this.shadowHelper.update();
      this.needsShadowUpdate = false;
    }
  }

  updateSunPosition(x: number, y: number, z: number): void {
    if (this.sun) {
      this.sun.position.set(x, y, z);
      
      // Update shadow camera position to follow the light
      if (this.sun.shadow && this.sun.target) {
        // Ensure the shadow camera is looking at the scene center
        this.sun.target.position.set(0, 0, 0);
        this.sun.target.updateMatrixWorld();
      }
      
      this.updateSkyUniforms();
      
      if (this.shadowHelper) {
        this.shadowHelper.update();
      }
    }
  }

  /**
   * Update sun position using realistic solar calculations
   */
  updateRealisticSunPosition(sunPosition: SunPosition): void {
    this.currentSunPosition = sunPosition;
    this.isUsingRealisticSun = true;
    
    if (this.sun) {
      // Update sun position
      this.sun.position.set(sunPosition.x, sunPosition.y, sunPosition.z);
      
      // Update sun intensity based on elevation
      const intensity = getSunIntensity(sunPosition.elevation);
      this.sun.intensity = intensity;
      
      // Update sun color based on elevation (warmer colors at low elevations)
      const isDarkTheme = document.documentElement.classList.contains('dark-theme');
      if (sunPosition.elevation < 0) {
        // Night time - use moon color
        this.sun.color.setHex(isDarkTheme ? 0x133b7a : 0x4a6ba8);
        this.sun.intensity = 0.3; // Moonlight is dimmer
      } else if (sunPosition.elevation < 10) {
        // Sunrise/sunset - warm colors
        this.sun.color.setHex(0xffa500); // Orange
        this.sun.intensity = intensity * 0.8;
      } else {
        // Daytime - use theme color
        const sunColor = getThemeColorAsHex('--color-sun-light', isDarkTheme ? 0x133b7a : 0xfaf6ed);
        this.sun.color.setHex(sunColor);
        this.sun.intensity = intensity;
      }
      
      // Update shadow camera position
      if (this.sun.shadow && this.sun.target) {
        this.sun.target.position.set(0, 0, 0);
        this.sun.target.updateMatrixWorld();
      }
      
      // Update ambient light based on sun position
      if (this.ambient) {
        const ambientIntensity = getAmbientIntensity(sunPosition.elevation);
        this.ambient.intensity = ambientIntensity;
        
        // Adjust ambient color based on time of day
        if (sunPosition.elevation < 0) {
          this.ambient.color.setHex(0x0c1625); // Night ambient
        } else if (sunPosition.elevation < 10) {
          this.ambient.color.setHex(0x4a3728); // Warm ambient for sunrise/sunset
        } else {
          const ambientColor = getThemeColorAsHex('--color-ambient-light', 0xffffff);
          this.ambient.color.setHex(ambientColor);
        }
      }
      
      // Update hemisphere light
      if (this.hemiLight) {
        const hemiIntensity = getAmbientIntensity(sunPosition.elevation) * 0.5;
        this.hemiLight.intensity = hemiIntensity;
      }
      
      // Update sky uniforms
      this.updateSkyUniforms();
      
      // Update shadow helper
      if (this.shadowHelper) {
        this.shadowHelper.update();
      }
    }
  }

  /**
   * Enable or disable realistic sun positioning
   */
  setRealisticSunMode(enabled: boolean): void {
    this.isUsingRealisticSun = enabled;
    
    if (enabled && !this.currentSunPosition) {
      // Initialize with current sun position
      this.currentSunPosition = getCurrentSunPosition();
      this.updateRealisticSunPosition(this.currentSunPosition);
    } else if (!enabled) {
      // Restore manual sun position
      this.updateSunPosition(
        this.config.sunPosition!.x,
        this.config.sunPosition!.y,
        this.config.sunPosition!.z
      );
    }
  }

  /**
   * Get current realistic sun position
   */
  getCurrentRealisticSunPosition(): SunPosition | null {
    return this.currentSunPosition;
  }

  /**
   * Check if realistic sun positioning is enabled
   */
  isRealisticSunEnabled(): boolean {
    return this.isUsingRealisticSun;
  }

  // Add method to get shadow information for debugging
  getShadowInfo(): { enabled: boolean; mapSize: number; bounds: number; position: THREE.Vector3 | null } {
    if (!this.sun) {
      return { enabled: false, mapSize: 0, bounds: 0, position: null };
    }
    
    return {
      enabled: this.sun.castShadow,
      mapSize: this.sun.shadow?.mapSize.width || 0,
      bounds: this.config.shadowCameraBounds!,
      position: this.sun.position.clone()
    };
  }

  // Expose the updateShadowBounds method
  updateShadowBounds(minBounds: number = 30, maxBounds: number = 100): void {
    if (!this.sun || !this.sun.shadow) return;
    
    // Calculate appropriate bounds based on scene size
    const bounds = Math.max(minBounds, Math.min(maxBounds, this.config.shadowCameraBounds!));
    
    this.sun.shadow.camera.left = -bounds;
    this.sun.shadow.camera.right = bounds;
    this.sun.shadow.camera.top = bounds;
    this.sun.shadow.camera.bottom = -bounds;
    this.sun.shadow.camera.updateProjectionMatrix();
    
    // Update config for future reference
    this.config.shadowCameraBounds = bounds;
    
    console.log(`Shadow bounds updated to: ${bounds}`);
    
    if (this.shadowHelper) {
      this.shadowHelper.update();
    }
  }

  fitShadowCameraToObjects(objects: THREE.Object3D[], padding = 1.35): void {
    if (!this.sun || !this.sun.shadow || objects.length === 0) return;
    const box = new THREE.Box3();
    objects.forEach(object => box.expandByObject(object));
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 1);
    const bounds = Math.max(12, maxDimension * 0.7 * padding);
    const direction = this.sun.position.clone().sub(this.sun.target.position).normalize();
    const distance = Math.max(100, maxDimension * 3);

    this.sun.target.position.copy(center);
    this.sun.target.updateMatrixWorld(true);
    this.sun.position.copy(center).add(direction.multiplyScalar(distance));
    this.sun.shadow.camera.left = -bounds;
    this.sun.shadow.camera.right = bounds;
    this.sun.shadow.camera.top = bounds;
    this.sun.shadow.camera.bottom = -bounds;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = distance + maxDimension * 2;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.config.shadowCameraBounds = bounds;
    this.sun.shadow.needsUpdate = true;
    this.shadowHelper?.update();
  }

  updateThemeColors(): void {
    const isDarkTheme = document.documentElement.classList.contains('dark-theme');
    
    // Update sunlight color
    if (this.sun) {
      const sunColor = getThemeColorAsHex('--color-sun-light', isDarkTheme ? 0x133b7a : 0xfaf6ed);
      this.sun.color.setHex(sunColor);
      
      // Adjust intensity based on theme - moonlight is much less intense than sunlight
      this.sun.intensity = isDarkTheme ? 0.5 : 1.8;
      
      // Update shadow properties for the theme
      if (this.sun.shadow) {
        this.sun.shadow.bias = isDarkTheme ? -0.0002 : -0.00008;
        this.sun.shadow.normalBias = isDarkTheme ? 0.03 : 0.035;
        // Softer, blurrier shadows at night
        this.sun.shadow.radius = isDarkTheme ? 7 : 4;
        this.sun.shadow.blurSamples = isDarkTheme ? 20 : 16;
      }
      
      // Update sun position for day/night effect
      if (isDarkTheme) {
        // Night - low angle moonlight position
        this.sun.position.set(45, 15, 35);
      } else {
        // Day - high sun position
        this.sun.position.set(75, 115, 65);
      }
      
      try {
        // Safely update sky if available
        this.updateSkyUniforms();
      } catch (error) {
        console.warn('Error updating sky uniforms during theme change:', error);
      }
    }
    
    // Update ambient light color
    if (this.ambient) {
      const ambientColor = getThemeColorAsHex('--color-ambient-light', isDarkTheme ? 0x0c1625 : 0xffffff);
      this.ambient.color.setHex(ambientColor);
      
      // Adjust intensity based on theme
      this.ambient.intensity = isDarkTheme ? 0.2 : 0.28;
    }
    
    // Update hemisphere light colors
    if (this.hemiLight) {
      const skyColor = getThemeColorAsHex('--color-hemisphere-sky', isDarkTheme ? 0x0a1525 : 0xC8D6E3);
      const groundColor = getThemeColorAsHex('--color-hemisphere-ground', isDarkTheme ? 0x102137 : 0xC7C2B7);
      this.hemiLight.color.setHex(skyColor);
      this.hemiLight.groundColor.setHex(groundColor);
      
      // Adjust intensity based on theme
      this.hemiLight.intensity = isDarkTheme ? 0.15 : 0.30;
    }
  }

  // Getter methods for color debugging
  getSunLightColor(): THREE.Color {
    return this.sun ? this.sun.color : getThemeColorAsThreeColor('--color-sun-light', 0xffffff);
  }

  getAmbientLightColor(): THREE.Color {
    return this.ambient ? this.ambient.color : getThemeColorAsThreeColor('--color-ambient-light', 0xffffff);
  }

  getHemisphereSkyColor(): THREE.Color {
    return this.hemiLight ? this.hemiLight.color : getThemeColorAsThreeColor('--color-hemisphere-sky', 0xffffff);
  }

  getHemisphereGroundColor(): THREE.Color {
    return this.hemiLight ? this.hemiLight.groundColor : getThemeColorAsThreeColor('--color-hemisphere-ground', 0xffffff);
  }

  dispose(): void {
    // Dispose sun target
    if (this.sun && this.sun.target) {
      this.scene.remove(this.sun.target);
    }
    
    // Dispose shadow helper
    if (this.shadowHelper) {
      this.scene.remove(this.shadowHelper);
      this.shadowHelper = null;
    }
    
    // Dispose sun light and shadow map
    if (this.sun) {
      if (this.sun.shadow?.map) {
        this.sun.shadow.map.dispose();
      }
      this.scene.remove(this.sun);
      this.sun = null;
    }
    
    // Dispose sky
    if (this.sky) {
      if (this.sky.material) {
        this.sky.material.dispose();
      }
      if (this.sky.geometry) {
        this.sky.geometry.dispose();
      }
      this.scene.remove(this.sky);
      this.sky = null;
    }
  }
}
