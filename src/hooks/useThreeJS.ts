/**
 * useThreeJS Hook
 * 
 * This custom React hook encapsulates the initialization and management of a Three.js 3D scene.
 * It handles the creation of essential Three.js components including:
 * - Scene: The container for all 3D objects
 * - Camera: Perspective camera that determines the viewpoint
 * - Renderer: WebGL renderer that draws the scene
 * - Lighting: Multiple light sources for realistic rendering
 * - Controls: Orbit controls for user interaction
 * - Ground plane and grid: For spatial reference
 * - Post-processing: Effects like ambient occlusion for visual enhancement
 * 
 * Usage:
 * const { scene, camera, renderer, isInitialized, toggleGrid } = useThreeJS(containerRef, showGrid);
 * 
 * @param containerRef - React ref to the DOM element that will contain the Three.js canvas
 * @param showGrid - Boolean to control grid visibility (default: true)
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import type { Object3D } from 'three';
// No need to import THREE directly in this hook
import { ThreeJSCore } from '../core/ThreeJSCore';
import type { CameraType, CameraView, ViewTransitionOptions } from '../core/ThreeJSCore';
import type { SceneAppearanceMode } from '../core/ThreeJSCore';
import type { SunPosition } from '../utils/sunPosition';

export const useThreeJS = (containerRef: React.RefObject<HTMLDivElement>, showGrid: boolean = true) => {
  const coreRef = useRef<ThreeJSCore | null>(null);
  const pendingSunPositionRef = useRef<SunPosition | null>(null);
  const initialShowGridRef = useRef(showGrid);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [showFPS, setShowFPS] = useState(false);

  // Initialize Three.js core
  useEffect(() => {
    if (!containerRef.current || coreRef.current) return;
    
    let isMounted = true;
    
    const initializeCore = async () => {
      if (!containerRef.current) return;
      
      setIsInitializing(true);
      setInitializationError(null);
      
      try {
        const core = new ThreeJSCore({
          container: containerRef.current,
          enablePostProcessing: true,
          showGrid: true // Always initialize with grid, then toggle it
        });
        
        await core.initialize();
        
        // Add a small delay to ensure everything is properly initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (isMounted) {
          coreRef.current = core;
          if (pendingSunPositionRef.current) {
            core.updateRealisticSunPosition(pendingSunPositionRef.current);
          }
          
          // Validate core is ready
          const scene = core.getScene();
          const camera = core.getCamera();
          const groundPlane = core.getGroundPlane();
          
          if (!scene || !camera || !groundPlane) {
            throw new Error('Core components not properly initialized');
          }
          
          console.log('ThreeJS Core fully initialized:', {
            scene: !!scene,
            camera: !!camera,
            groundPlane: !!groundPlane,
            sceneChildren: scene.children.length
          });
          
          // Set initial grid visibility after initialization
          if (!initialShowGridRef.current) {
            core.toggleGrid();
          }
          setIsInitialized(true);
        }
      } catch (error) {
        if (isMounted) {
          setInitializationError(error instanceof Error ? error.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };
    
    initializeCore();
    
    return () => {
      isMounted = false;
      if (coreRef.current) {
        coreRef.current.dispose();
        coreRef.current = null;
      }
    };
  }, [containerRef]); // Remove showGrid from dependencies

  // Update grid visibility when showGrid changes
  useEffect(() => {
    if (coreRef.current && isInitialized) {
      // Get current grid visibility and only toggle if different
      const currentVisibility = coreRef.current.getGridVisibility();
      if (currentVisibility !== showGrid) {
        coreRef.current.toggleGrid();
      }
    }
  }, [showGrid, isInitialized]);

  const toggleGrid = useCallback(() => {
    if (coreRef.current) {
      coreRef.current.toggleGrid();
    }
  }, []);

  const toggleFPSCounter = useCallback(() => {
    setShowFPS(prev => {
      const newValue = !prev;
      if (coreRef.current) {
        coreRef.current.toggleFPSCounter();
      }
      return newValue;
    });
  }, []);

  const togglePerformanceMode = useCallback(() => {
    // This function is kept for compatibility but does nothing
    console.log('Performance mode toggle disabled - single render mode only');
  }, []);

  const retryInitialization = useCallback(() => {
    if (coreRef.current) {
      coreRef.current.dispose();
      coreRef.current = null;
    }
    setIsInitialized(false);
    setInitializationError(null);
    // The useEffect will reinitialize automatically
  }, []);

  const switchCameraType = useCallback((type: CameraType) => {
    if (coreRef.current) {
      try {
        coreRef.current.switchCameraType(type);
        console.log(`Camera type switched to: ${type}`);
      } catch (error) {
        console.error('Failed to switch camera type:', error);
      }
    } else {
      console.warn('Cannot switch camera type - core not initialized');
    }
  }, []);

  const setCameraView = useCallback((view: CameraView, options?: ViewTransitionOptions) => {
    if (coreRef.current) {
      try {
        coreRef.current.setCameraView(view, options);
        console.log(`Camera view set to: ${view}`);
      } catch (error) {
        console.error('Failed to set camera view:', error);
      }
    } else {
      console.warn('Cannot set camera view - core not initialized');
    }
  }, []);
  const fitCameraToObjects = useCallback((objects: Object3D[], options?: ViewTransitionOptions) => {
    coreRef.current?.fitCameraToObjects(objects, options);
  }, []);
  const fitShadowsToObjects = useCallback((objects: Object3D[]) => {
    coreRef.current?.fitShadowsToObjects(objects);
  }, []);

  const getCurrentCameraType = useCallback((): CameraType | undefined => {
    if (coreRef.current) {
      try {
        return coreRef.current.getCurrentCameraType();
      } catch (error) {
        console.error('Failed to get current camera type:', error);
      }
    }
    return undefined;
  }, []);
  const refreshThemeColors = useCallback(() => {
    if (coreRef.current) {
      coreRef.current.refreshThemeColors();
    }
  }, []);
  const updateSunPosition = useCallback((sunPosition: SunPosition) => {
    pendingSunPositionRef.current = sunPosition;
    if (coreRef.current) {
      try {
        coreRef.current.updateRealisticSunPosition(sunPosition);
        console.log('Sun position updated:', sunPosition);
      } catch (error) {
        console.error('Failed to update sun position:', error);
      }
    }
  }, []);
  const enableBuildingFocus = useCallback((buildingId: string) => {
    if (coreRef.current) {
      try {
        coreRef.current.enableBuildingFocus(buildingId);
        console.log('Building focus enabled for:', buildingId);
      } catch (error) {
        console.error('Failed to enable building focus:', error);
      }
    } else {
      console.warn('Cannot enable building focus - core not initialized');
    }
  }, []);
  const disableBuildingFocus = useCallback(() => {
    if (coreRef.current) {
      try {
        coreRef.current.disableBuildingFocus();
        console.log('Building focus disabled');
      } catch (error) {
        console.error('Failed to disable building focus:', error);
      }
    } else {
      console.warn('Cannot disable building focus - core not initialized');
    }
  }, []);
  const setSceneAppearanceMode = useCallback((mode: SceneAppearanceMode) => {
    if (!coreRef.current) return;
    coreRef.current.setSceneAppearanceMode(mode);
  }, []);
  const setCameraControlsEnabled = useCallback((enabled: boolean) => {
    coreRef.current?.setCameraControlsEnabled(enabled);
  }, []);

  const getCamera = useCallback(() => coreRef.current?.getCamera() ?? null, []);
  const setPlanMode = useCallback((plan: boolean) => coreRef.current?.setPlanMode(plan), []);
  const setSpacePan = useCallback((active: boolean) => coreRef.current?.setSpacePan(active), []);

  return {
    getCamera, setPlanMode, setSpacePan,
    scene: coreRef.current?.getScene() || null,
    camera: coreRef.current?.getCamera() || null,
    renderer: coreRef.current?.getRenderer() || null,
    groundPlane: coreRef.current?.getGroundPlane() || null,
    windowService: coreRef.current?.getWindowService() || null,
    isInitialized,
    isInitializing,
    initializationError,
    showFPS,
    toggleGrid,
    toggleFPSCounter,
    togglePerformanceMode,
    retryInitialization,
    switchCameraType,
    getCurrentCameraType,
    setCameraView,
    fitCameraToObjects,
    fitShadowsToObjects,
    refreshThemeColors,
    updateSunPosition,
    enableBuildingFocus,
    disableBuildingFocus,
    setSceneAppearanceMode,
    setCameraControlsEnabled,
    debugHelpers: {
      toggleShadowHelper: () => {},
      toggleShadowQuality: () => {},
      enablePerformanceMonitoring: () => {}
    }
  };
};
