import * as THREE from 'three';
import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { SceneAppearanceManager, type SceneAppearanceMode } from './SceneAppearanceManager';

export interface RendererConfig {
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
  alpha?: boolean;
  shadows?: boolean;
  shadowType?: THREE.ShadowMapType;
  pixelRatio?: number;
  toneMapping?: THREE.ToneMapping;
  toneMappingExposure?: number;
}

export class RendererManager {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private passes: Pass[] = [];
  private config: RendererConfig;
  private readonly sceneAppearance = new SceneAppearanceManager();

  constructor(config: RendererConfig = {}) {
    this.config = {
      antialias: true,
      preserveDrawingBuffer: false,
      alpha: false,
      shadows: true,
      shadowType: THREE.PCFSoftShadowMap,
      pixelRatio: Math.min(window.devicePixelRatio, 1.5),
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.0, // Slightly reduced from 1.2 for better shadow balance
      ...config
    };
    
    this.renderer = this.createRenderer();
  }
  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: this.config.antialias,
      preserveDrawingBuffer: this.config.preserveDrawingBuffer,
      alpha: this.config.alpha,
      stencil: false,
      powerPreference: 'high-performance'
    });
    
    // Shadow configuration - use PCFSoftShadowMap for softer shadows
    renderer.shadowMap.enabled = this.config.shadows!;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Force soft shadows
    renderer.shadowMap.autoUpdate = true;
    
    // Color space and tone mapping
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = this.config.toneMapping!;
    renderer.toneMappingExposure = this.config.toneMappingExposure!;
    
    // Performance optimizations
    renderer.setPixelRatio(this.config.pixelRatio!);
    
    return renderer;
  }

  async initializeComposer(scene: THREE.Scene, camera: THREE.Camera, enablePostProcessing: boolean = true): Promise<void> {
    if (!enablePostProcessing) return;
    
    try {
      const [
        { EffectComposer },
        { RenderPass },
        { SAOPass },
        { OutputPass }
      ] = await Promise.all([
        import('three/examples/jsm/postprocessing/EffectComposer.js'),
        import('three/examples/jsm/postprocessing/RenderPass.js'),
        import('three/examples/jsm/postprocessing/SAOPass.js'),
        import('three/examples/jsm/postprocessing/OutputPass.js')
      ]);

      // Dispose existing composer
      this.disposeComposer();

      this.composer = new EffectComposer(this.renderer);
      
      const renderPass = new RenderPass(scene, camera);
      this.composer.addPass(renderPass);
      this.passes.push(renderPass);      const saoPass = new SAOPass(scene, camera);
      saoPass.params.saoBias = 0.2;            // Lower bias for more subtle effect
      saoPass.params.saoIntensity = 0.015;      // Slightly increased intensity
      saoPass.params.saoScale = 10;            // Increased scale for broader effect
      saoPass.params.saoKernelRadius = 25;     // Increased radius for softer shadows
      saoPass.params.saoMinResolution = 0.0075; // Smaller value for finer details
      saoPass.params.saoBlur = true;           // Keep blur enabled
      saoPass.params.saoBlurRadius = 4;        // Increased blur radius
      saoPass.params.saoBlurStdDev = 2;        // Increased standard deviation for softer blur
      saoPass.params.saoBlurDepthCutoff = 0.0075; // Adjusted depth cutoff
      this.composer.addPass(saoPass);
      this.passes.push(saoPass);

      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);
      this.passes.push(outputPass);
      
    } catch (error) {
      console.error('Failed to initialize post-processing composer:', error);
      throw new Error(`Post-processing initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getComposer(): EffectComposer | null {
    return this.composer;
  }

  setSize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.config.pixelRatio!);
    
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.composer) {
      // Update composer's render pass camera if it changed
      if (this.passes.length > 0 && 'camera' in this.passes[0]) {
        const renderPass = this.passes[0] as Pass & { camera: THREE.Camera };
        if (renderPass.camera !== camera) {
          renderPass.camera = camera;
        }
      }
      this.composer.render();
    } else {
      this.renderer.render(scene, camera);
    }
  }

  private disposeComposer(): void {
    if (this.composer) {
      this.passes.forEach(pass => {
        if ('dispose' in pass && typeof pass.dispose === 'function') {
          pass.dispose();
        }
      });
      this.passes.length = 0;
      this.composer.dispose();
      this.composer = null;
    }
  }

  dispose(): void {
    this.sceneAppearance.restore();
    this.disposeComposer();
    
    // Dispose renderer resources
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    
    // Clear render lists
    this.renderer.info.memory.geometries = 0;
    this.renderer.info.memory.textures = 0;
  }
  
  /**
   * Update renderer settings based on current theme
   */
  updateThemeColors(): void {
    const isDarkTheme = document.documentElement.classList.contains('dark-theme');
    
    // Adjust renderer tone mapping exposure based on theme
    if (this.renderer) {
      // Lower exposure for dark theme, brighter for light theme
      this.renderer.toneMappingExposure = isDarkTheme ? 0.8 : 1.1;
      
      // Update output encoding if needed
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      
      // Apply any additional renderer-specific theme settings
      if (isDarkTheme) {
        // Night mode specific settings
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      } else {
        // Day mode specific settings
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      
      // Force update
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  setSceneAppearanceMode(scene: THREE.Scene, mode: SceneAppearanceMode): void {
    this.sceneAppearance.setMode(scene, mode);
  }

}
