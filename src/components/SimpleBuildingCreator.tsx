import React, { useRef, useState, useEffect } from 'react';
import { useThreeJS } from '../hooks/useThreeJS';
import { useDrawing } from '../hooks/useDrawing';
import { useClickHandler } from '../hooks/useClickHandler';
import { useBuildingManager } from '../hooks/useBuildingManager';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { toggleTheme } from '../utils/themeColors';
import { LeftToolbar } from './LeftToolbar';
import { BottomToolbar } from './BottomToolbar';
import { FloatingInstructions } from './FloatingInstructions';
import { BuildingConfigPanel } from './BuildingConfigPanel';
import { BuildingEditPanel } from './BuildingEditPanel';
import { BuildingTooltip } from './BuildingTooltip';
import { SunController } from './SunController';
import { MiniGraphWindow } from './MiniGraphWindow';
import { DesignGraphDialog } from './DesignGraphDialog';
import { SaveConfigurationDialog } from './dialogs/SaveConfigurationDialog';
import { ImportConfigDialog } from './dialogs/ImportConfigDialog';
import { DaylightResultsDialog } from './dialogs/DaylightResultsDialog';
import { Tabs, TabContent } from './ui/Tabs';
import { WeatherAndLocationTab } from './WeatherAndLocationTab';
import { BuildingConfig, BuildingData } from '../types/building';
import type { CameraType, CameraView } from '../core/ThreeJSCore';
import { getThemeColorAsHex } from '../utils/themeColors';
import type { SunPosition } from '../utils/sunPosition';
import { addSampleBuilding } from '../utils/addSampleBuilding';
import { BuildingService } from '../services/BuildingService';
import { designExplorationService } from '../services/DesignExplorationService';
import { daylightApiService } from '../services/DaylightApiService';
import { daylightVisualizationService, getOverlayGroupsForResults } from '../services/DaylightVisualizationService';
import { DaylightRunState, DaylightRunSummary } from '../types/daylight';

type DaylightLegendState = {
  mode: 'df' | 'sda';
};

export const SimpleBuildingCreator: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'weather' | 'model'>('model');
  const [hasInteracted, setHasInteracted] = useState(false);
  const [hasInitializedWithSample, setHasInitializedWithSample] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showBuildingConfig, setShowBuildingConfig] = useState(false);
  const [showSunController, setShowSunController] = useState(false);
  const [showSaveConfigDialog, setShowSaveConfigDialog] = useState(false);
  const [showDesignGraphDialog, setShowDesignGraphDialog] = useState(false);
  const [showImportConfigDialog, setShowImportConfigDialog] = useState(false);
  const [showDaylightResultsDialog, setShowDaylightResultsDialog] = useState(false);
  const [activeResultsBuildingId, setActiveResultsBuildingId] = useState<string | null>(null);
  const [isSaveAndRunInProgress, setIsSaveAndRunInProgress] = useState(false);
  const [isBaselineSimRunning, setIsBaselineSimRunning] = useState(false);
  const [daylightResultsByBuildingId, setDaylightResultsByBuildingId] = useState<Record<string, DaylightRunSummary>>({});
  const [daylightLegend, setDaylightLegend] = useState<DaylightLegendState | null>(null);
  const [activeDaylightRunStatus, setActiveDaylightRunStatus] = useState<DaylightRunState | null>(null);
  const [daylightSimulationProgress, setDaylightSimulationProgress] = useState<{ completed: number; total: number } | null>(null);
  const runAbortControllerRef = useRef<AbortController | null>(null);
  const hasAutoRunBaselineRef = useRef(false);

  const updateDaylightLegend = React.useCallback((points: { value: number }[], mode: 'df' | 'sda') => {
    setDaylightLegend(points.length > 0 ? { mode } : null);
  }, []);

  const [buildingConfig, setBuildingConfig] = useState<BuildingConfig>({
    floors: 3,
    floorHeight: 3.5,
    color: getThemeColorAsHex('--color-building-default', 0x63666f1)
  });
  const [currentCameraType, setCurrentCameraType] = useState<CameraType>('perspective');
  // Initialize Three.js scene
  const { 
    scene, 
    camera, 
    groundPlane, 
    windowService,
    isInitialized, 
    isInitializing,
    initializationError,
    showFPS,
    toggleGrid, 
    toggleFPSCounter,
    retryInitialization,
    switchCameraType,
    setCameraView,
    updateSunPosition,
    enableBuildingFocus,
    disableBuildingFocus
  } = useThreeJS(containerRef, showGrid);
    // Initialize building management
  const { 
    buildings, 
    selectedBuilding, 
    buildingTooltip,
    selectBuilding, 
    updateBuilding, 
    clearAllBuildings, 
    exportBuildings, 
    buildingStats, 
    deleteBuilding, 
    handleBuildingInteraction,
    addBuilding,
    hideBuildingTooltip
  } = useBuildingManager(scene, camera as THREE.PerspectiveCamera | null, windowService);

  // Initialize drawing functionality
  const { 
    drawingState, 
    startDrawing, 
    stopDrawing, 
    addPoint, 
    finishBuilding, 
    updatePreview, 
    undoLastPoint, 
    clearAllDrawingElements 
  } = useDrawing(
    scene,
    camera,
    groundPlane,
    snapToGrid,
    buildingConfig,
    addBuilding
  );

  // Handle click events and mouse movement
  const isDrawingRef = React.useRef(drawingState.isDrawing);
  React.useEffect(() => {
    isDrawingRef.current = drawingState.isDrawing;
  }, [drawingState.isDrawing]);

  useClickHandler(
    containerRef,
    (event, container) => {
      // Only handle clicks when model tab is active
      if (activeTab !== 'model') return;
      
      if (!hasInteracted) setHasInteracted(true);
      
      if (drawingState.isDrawing) {
        addPoint(event, container);
      } else if (isInitialized && camera && scene) {
        const result = handleBuildingInteraction(event, container);
        
        if (result?.building && !result.building.mesh.userData.isPreview) {
          // Select the building to show the comprehensive BuildingEditPanel
          selectBuilding(result.building);
        } else if (!result) {
          selectBuilding(null);
        }
      }
    }, 
    () => finishBuilding(), 
    (event, container) => {
      // Only handle mouse move when model tab is active
      if (activeTab !== 'model') return;
      
      if (drawingState.isDrawing) {
        updatePreview(event, container);
      }
    },
    (event, container) => {
      // Only handle hover when model tab is active
      if (activeTab !== 'model') return;
      
      if (!drawingState.isDrawing && isInitialized && camera && scene) {
        handleBuildingInteraction(event, container);
      }
    },
    isDrawingRef
  );

  // Event handlers
  const handleStartDrawing = () => {
    if (!hasInteracted) setHasInteracted(true);
    
    // If already drawing, first stop any current drawing session
    if (drawingState.isDrawing) {
      stopDrawing();
      
      // Small delay to ensure cleanup completes before restarting
      setTimeout(() => {
        selectBuilding(null);
        startDrawing();
        
        // Force immediate preview update if mouse is over the container
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const lastMouseEvent = document.createEvent('MouseEvents');
          lastMouseEvent.initMouseEvent(
            'mousemove', true, true, window, 0,
            0, 0, rect.left + rect.width/2, rect.top + rect.height/2,
            false, false, false, false, 0, null
          );
          containerRef.current.dispatchEvent(lastMouseEvent);
        }
      }, 10);
      return;
    }
    
    // Normal start drawing flow
    selectBuilding(null);
    startDrawing();
  };

  const handleToggleGrid = () => {
    setShowGrid(!showGrid);
    toggleGrid();
  };

  const handleSaveConfiguration = () => {
    if (isSaveAndRunInProgress) {
      return;
    }

    setShowSaveConfigDialog(true);
  };

  const handleImportConfiguration = () => {
    setShowImportConfigDialog(true);
  };

  const handleToggleTheme = () => {
    const newTheme = toggleTheme();
    
    // Force Three.js scene to immediately update
    window.dispatchEvent(new CustomEvent('threejs-theme-update', { 
      detail: { theme: newTheme } 
    }));
  };

  const handleImportConfigConfirm = (config: any) => {
    try {
      // Clear current buildings
      clearAllBuildings();
      
      // Determine if config is an array of buildings or an object with buildings property
      const buildingsData = Array.isArray(config) ? config : config.buildings || [];
      
      if (!Array.isArray(buildingsData)) {
        throw new Error('Invalid configuration format');
      }

      // Recreate buildings from imported data
      const buildingService = new BuildingService(scene!);
      
      buildingsData.forEach((buildingData: any, index: number) => {
        try {
          // Validate required fields
          if (!buildingData.points || !Array.isArray(buildingData.points) || buildingData.points.length < 3) {
            throw new Error(`Building ${index + 1}: Invalid or missing points`);
          }

          // Create building config with defaults for missing properties
          const buildingConfig: BuildingConfig = {
            floors: buildingData.floors || 3,
            floorHeight: buildingData.floorHeight || 3.5,
            color: buildingData.color || getThemeColorAsHex('--color-building-default', 0x63666f1),
            name: buildingData.name || `Imported Building ${index + 1}`,
            description: buildingData.description || '',
            window_to_wall_ratio: buildingData.window_to_wall_ratio || 0.3,
            window_overhang: buildingData.window_overhang || false,
            window_overhang_depth: buildingData.window_overhang_depth || 0.5,
            wall_construction: buildingData.wall_construction || 'Standard Wall',
            floor_construction: buildingData.floor_construction || 'Standard Floor',
            roof_construction: buildingData.roof_construction || 'Standard Roof',
            window_construction: buildingData.window_construction || 'Standard Window',
            structural_system: buildingData.structural_system || 'Concrete',
            building_program: buildingData.building_program || 'Office',
            hvac_system: buildingData.hvac_system || 'Standard HVAC',
            natural_ventilation: buildingData.natural_ventilation || false
          };

          // Create the 3D mesh
          const mesh = buildingService.createBuilding(buildingData.points, buildingConfig);
          
          // Set metadata
          mesh.userData = {
            ...mesh.userData,
            buildingId: buildingData.id || `imported_${Date.now()}_${index}`,
            name: buildingConfig.name,
            description: buildingConfig.description
          };

          // Add the building to the manager
          addBuilding(mesh, buildingData.points, buildingConfig.floors, buildingConfig.floorHeight);
          
        } catch (error) {
          console.error(`Failed to import building ${index + 1}:`, error);
        }
      });

      console.log(`Successfully imported ${buildingsData.length} building(s)`);
      
    } catch (error) {
      console.error('Failed to import configuration:', error);
      // You could show an error dialog here
    }
  };

  const runDaylightSimulation = React.useCallback(async (
    targetBuilding: BuildingData,
    configurationName: string,
    buildingsForSnapshot?: BuildingData[],
    options?: { recordInGraph?: boolean; useGhosting?: boolean }
  ) => {
    const snapshotBuildings = buildingsForSnapshot && buildingsForSnapshot.length > 0
      ? buildingsForSnapshot
      : buildings;

    if (!scene || !targetBuilding || snapshotBuildings.length === 0) {
      throw new Error('At least one building is required to run daylight analysis.');
    }

    const now = new Date().toISOString();
    const configuredLocation = import.meta.env.VITE_DAYLIGHT_API_LOCATION as string | undefined;
    const resolvedLocation = configuredLocation || await daylightApiService.getDefaultLocation(runAbortControllerRef.current?.signal);
    const runSda = Boolean(resolvedLocation);
    const shouldRecordInGraph = options?.recordInGraph !== false;
    const useGhosting = options?.useGhosting !== false;

    const pendingNode = shouldRecordInGraph
      ? designExplorationService.saveConfiguration(
          snapshotBuildings,
          configurationName,
          { spatialDaylightAutonomy: 0 },
          {
            status: 'queued',
            updatedAt: now
          },
          daylightResultsByBuildingId
        )
      : null;

    runAbortControllerRef.current?.abort();
    runAbortControllerRef.current = new AbortController();
    setIsSaveAndRunInProgress(true);
    setActiveDaylightRunStatus({ status: 'queued', stage: 'Submitting study request...' });
    setDaylightSimulationProgress(snapshotBuildings.length > 1 ? { completed: 0, total: snapshotBuildings.length } : null);

    // Ghosting is used for user-triggered runs, but can be disabled for baseline startup runs.
    if (useGhosting) {
      enableBuildingFocus('__daylight_overlay__');
    }
    daylightVisualizationService.clear(scene);

    try {
      let perStudyCompleted = 0;
      const results = await Promise.all(
        snapshotBuildings.map((building) =>
          daylightApiService.runStudyForBuilding(
            building,
            {
              run_sda: runSda,
              location: resolvedLocation,
              quality: 'draft',
              selected_floor_number: Math.max(1, building.floors),
              context_buildings: snapshotBuildings
                .filter((contextBuilding) => contextBuilding.id !== building.id)
                .map((contextBuilding) => daylightApiService.buildContextBuilding(contextBuilding))
            },
            {
              signal: runAbortControllerRef.current!.signal,
              onStatus: ({ status, studyId, stage, error }) => {
                setActiveDaylightRunStatus({
                  status,
                  studyId,
                  stage: `${building.name || 'Building'}: ${stage || status}`,
                  error
                });

                if (pendingNode) {
                  designExplorationService.updateNode(pendingNode.id, {
                    daylightRun: {
                      status,
                      studyId,
                      stage,
                      error,
                      updatedAt: new Date().toISOString()
                    }
                  });
                }
              }
            }
          ).then((studyResult) => {
            // Increment after the individual promise settles so the counter
            // advances one step at a time, not all at once after Promise.all.
            perStudyCompleted += 1;
            setDaylightSimulationProgress((prev) =>
              prev ? { completed: perStudyCompleted, total: prev.total } : prev
            );
            return studyResult;
          })
        )
      );
      const resultsById = Object.fromEntries(
        snapshotBuildings.map((building, index) => [building.id, results[index]])
      );
      const allPoints = results.flatMap((result) => result.points);
      const result = resultsById[targetBuilding.id];

      const resultGroups = results.map((r) => r.points).filter((pts) => pts.length > 0);
      daylightVisualizationService.renderSensorPointGroups(scene, resultGroups);
      setDaylightResultsByBuildingId((prev) => ({ ...prev, ...resultsById }));
      updateDaylightLegend(allPoints, 'df');

      if (pendingNode) {
        designExplorationService.updateNode(pendingNode.id, {
          metrics: {
            spatialDaylightAutonomy: runSda
              ? results.reduce((total, current) => total + current.sda, 0) / results.length
              : pendingNode.metrics.spatialDaylightAutonomy
          },
          daylightRun: {
            status: 'complete',
            studyId: result.studyId,
            stage: result.stage,
            sensorCount: results.reduce((total, current) => total + current.sensorCount, 0),
            meanDF: results.reduce((total, current) => total + current.meanDF, 0) / results.length,
            updatedAt: result.completedAt || new Date().toISOString()
          },
          daylightResultsByBuildingId: resultsById
        });
      }

      setActiveDaylightRunStatus({
        status: 'complete',
        studyId: result.studyId,
        stage: result.stage || 'Completed'
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown daylight simulation error';
      setActiveDaylightRunStatus({
        status: 'failed',
        error: message,
        stage: 'Simulation failed'
      });

      if (pendingNode) {
        designExplorationService.updateNode(pendingNode.id, {
          daylightRun: {
            status: 'failed',
            error: message,
            updatedAt: new Date().toISOString()
          }
        });
      }

      throw error;
    } finally {
      if (useGhosting) {
        disableBuildingFocus();
      }
      setIsSaveAndRunInProgress(false);
      setActiveDaylightRunStatus(null);
      setDaylightSimulationProgress(null);
      runAbortControllerRef.current = null;
    }
  }, [scene, buildings, daylightResultsByBuildingId, enableBuildingFocus, disableBuildingFocus, updateDaylightLegend]);

  const handleSaveConfigurationConfirm = async (name: string) => {
    const targetBuilding = selectedBuilding || buildings[0];
    if (!targetBuilding) {
      throw new Error('At least one building is required to run daylight analysis.');
    }

    await runDaylightSimulation(targetBuilding, name);
  };

  const handleOpenDesignGraph = () => {
    setShowDesignGraphDialog(true);
  };

  const handleReinstateConfiguration = (nodeId: string) => {
    const node = designExplorationService.reinstateConfiguration(nodeId);
    setShowDaylightResultsDialog(false);
    setActiveResultsBuildingId(null);
    setDaylightLegend(null);
    if (node && scene) {
      // Clear current buildings
      clearAllBuildings();
      
      // Recreate buildings from saved data
      const buildingService = new BuildingService(scene);
      
      node.buildings.forEach(buildingData => {
        try {
          // Create building config from saved data
          const buildingConfig: BuildingConfig = {
            floors: buildingData.floors,
            floorHeight: buildingData.floorHeight,
            color: buildingData.color || getThemeColorAsHex('--color-building-default', 0x63666f1),
            name: buildingData.name,
            description: buildingData.description,
            window_to_wall_ratio: buildingData.window_to_wall_ratio,
            window_overhang: buildingData.window_overhang,
            window_overhang_depth: buildingData.window_overhang_depth,
            wall_construction: buildingData.wall_construction,
            floor_construction: buildingData.floor_construction,
            roof_construction: buildingData.roof_construction,
            window_construction: buildingData.window_construction,
            structural_system: buildingData.structural_system,
            building_program: buildingData.building_program,
            hvac_system: buildingData.hvac_system,
            natural_ventilation: buildingData.natural_ventilation
          };

          // Create the 3D mesh
          const mesh = buildingService.createBuilding(buildingData.points, buildingConfig);
          
          // Set the original building ID to maintain consistency
          mesh.userData = {
            ...mesh.userData,
            buildingId: buildingData.id,
            name: buildingData.name,
            description: buildingData.description
          };

          // Add the building back to the manager
          addBuilding(mesh, buildingData.points, buildingData.floors, buildingData.floorHeight);
          
        } catch (error) {
          console.error('Failed to recreate building:', buildingData.id, error);
        }
      });

      const reinstatedResults = node.daylightResultsByBuildingId || {};
      setDaylightResultsByBuildingId(reinstatedResults);

      const restoredGroups = getOverlayGroupsForResults(reinstatedResults, 'df');
      if (restoredGroups.length > 0) {
        daylightVisualizationService.renderSensorPointGroups(scene, restoredGroups);
        updateDaylightLegend(restoredGroups.flat(), 'df');
      } else {
        daylightVisualizationService.clear(scene);
        updateDaylightLegend([], 'df');
      }

      console.log('Configuration reinstated:', node.name, `(${node.buildings.length} buildings)`);
    }
    setShowDesignGraphDialog(false);
  };

  const handlePreviewBuilding = (updates: any) => {
    if (selectedBuilding) {
      updateBuilding(selectedBuilding.id, updates);
      // Don't close the dialog - keep it open for live preview
    }
  };

  const handleEditBuilding = (building: any) => {
    // Only select non-preview buildings
    if (!building.mesh.userData.isPreview && !building.mesh.userData.isDrawingElement) {
      selectBuilding(building);
    }
  };

  const handleViewBuildingResult = (building: any) => {
    if (!scene) {
      return;
    }

    const result = daylightResultsByBuildingId[building.id];
    if (!result) {
      return;
    }

    const overlayGroups = getOverlayGroupsForResults(daylightResultsByBuildingId, 'df');
    daylightVisualizationService.renderSensorPointGroups(scene, overlayGroups);
    updateDaylightLegend(overlayGroups.flat(), 'df');
    setActiveResultsBuildingId(building.id);
    setShowDaylightResultsDialog(true);
  };

  const handleSelectBuildingResult = (buildingId: string) => {
    const result = daylightResultsByBuildingId[buildingId];
    if (!result || !scene) {
      return;
    }

    const overlayGroups = getOverlayGroupsForResults(daylightResultsByBuildingId, 'df');
    daylightVisualizationService.renderSensorPointGroups(scene, overlayGroups);
    updateDaylightLegend(overlayGroups.flat(), 'df');
    setActiveResultsBuildingId(buildingId);
  };

  const handleDeleteBuilding = (buildingId: string) => {
    deleteBuilding(buildingId);
    setDaylightResultsByBuildingId((prev) => {
      if (!(buildingId in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[buildingId];
      return next;
    });

    if (activeResultsBuildingId === buildingId) {
      setShowDaylightResultsDialog(false);
      setActiveResultsBuildingId(null);
    }
  };

  const handleClearAll = () => {
    clearAllBuildings();
    setDaylightResultsByBuildingId({});
    setShowDaylightResultsDialog(false);
    setActiveResultsBuildingId(null);
    setDaylightLegend(null);
    if (scene) {
      daylightVisualizationService.clear(scene);
    }
    // Don't clear drawing elements when using the Clear All button from LeftToolbar
    // Only clear selected building and reset UI state
    selectBuilding(null);
    
    // Force service state reset
    setTimeout(() => {
      if (showBuildingConfig) setShowBuildingConfig(false);
    }, 100);
  };

  const handleSwitchCameraType = (type: CameraType) => {
    if (switchCameraType) {
      switchCameraType(type);
      setCurrentCameraType(type);
    }
  };

  const handleSetCameraView = (view: CameraView) => {
    if (setCameraView) {
      setCameraView(view, { duration: 1000 });    }
  };

  // Handle sun position updates from SunController
  const handleSunPositionChange = (sunPosition: SunPosition) => {
    if (updateSunPosition) {
      updateSunPosition(sunPosition);
    }
  };

  // Determine instruction mode
  const getInstructionMode = () => {
    if (!hasInteracted && !drawingState.isDrawing && buildings.length === 0 && isInitialized) {
      return 'welcome';
    }
    if (drawingState.isDrawing) {
      return 'drawing';
    }
    if (!drawingState.isDrawing && buildings.length > 0 && !selectedBuilding && !showBuildingConfig) {
      return 'selection';
    }
    return null;
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onDrawBuilding: () => {
      if (activeTab !== 'model') return;
      if (!hasInteracted) setHasInteracted(true);
      selectBuilding(null);
      startDrawing();
    },
    onToggleGrid: () => {
      if (activeTab !== 'model') return;
      setShowGrid(!showGrid);
      toggleGrid();
    },
    onToggleSnap: () => {
      if (activeTab !== 'model') return;
      setSnapToGrid(!snapToGrid);
    },
    onToggleFPS: () => {
      if (activeTab !== 'model') return;
      toggleFPSCounter();
    },
    onShowConfig: () => {
      if (activeTab !== 'model') return;
      setShowBuildingConfig(!showBuildingConfig);
    },
    onExport: () => {
      if (activeTab !== 'model') return;
      exportBuildings();
    },
    onClearAll: () => {
      if (activeTab !== 'model') return;
      clearAllBuildings();
      if (clearAllDrawingElements) clearAllDrawingElements();
      selectBuilding(null);
    },
    onEscape: () => {
      if (activeTab !== 'model') return;
      if (drawingState.isDrawing) {
        stopDrawing();
      } else if (selectedBuilding) {
        selectBuilding(null);
      } else if (showBuildingConfig) {
        setShowBuildingConfig(false);
      }
    },
    onUndoLastPoint: () => {
      if (activeTab !== 'model') return;
      undoLastPoint();
    },
    onSaveConfiguration: () => {
      if (activeTab !== 'model') return;
      handleSaveConfiguration();
    },
    onImportConfiguration: () => {
      if (activeTab !== 'model') return;
      handleImportConfiguration();
    },
    onToggleSunController: () => {
      if (activeTab !== 'model') return;
      setShowSunController(!showSunController);
    },
    onToggleTheme: handleToggleTheme, // Theme toggle should work on both tabs
    isDrawing: drawingState.isDrawing,
    isInitialized
  });

  useEffect(() => {
    return () => {
      runAbortControllerRef.current?.abort();
      if (scene) {
        daylightVisualizationService.clear(scene);
      }
      disableBuildingFocus();
    };
  }, [scene, disableBuildingFocus]);

  // Initialize with a sample rectangular building when the scene is ready (only once)
  useEffect(() => {
    if (isInitialized && scene && buildings.length === 0 && !hasInitializedWithSample) {
      console.log('Initializing app with sample 10x5m room building...');
      
      try {
        // Create building service for sample building
        const buildingService = new BuildingService(scene);
        
        // Create a sample 10m x 5m room building at the center
        const sampleBuilding = addSampleBuilding(buildingService, windowService, {
          centerX: 0,
          centerZ: 0,
          width: 10,
          depth: 5,
          floors: 6,
          floorHeight: 3.5,
          color: getThemeColorAsHex('--color-building-sample', 0x4A90E2),
          name: 'Welcome Room (10m x 5m)',
          description: 'A 10m x 5m starter room with 6 storeys',
          windowToWallRatio: 0.4
        });

        if (sampleBuilding) {
          // Add the building to the building manager
          const managedBuilding = addBuilding(
            sampleBuilding.mesh,
            sampleBuilding.points,
            sampleBuilding.floors,
            sampleBuilding.floorHeight
          );

          if (managedBuilding) {
            console.log('✅ Sample room building added successfully:', managedBuilding.id);
            
            // Set user as having interacted so welcome screen doesn't show
            setHasInteracted(true);
            // Mark that we've initialized with a sample building
            setHasInitializedWithSample(true);

            if (!hasAutoRunBaselineRef.current) {
              hasAutoRunBaselineRef.current = true;
              void (async () => {
                setIsBaselineSimRunning(true);
                try {
                  const baselineResult = await runDaylightSimulation(
                    managedBuilding,
                    'Baseline Auto Run',
                    [managedBuilding],
                    { recordInGraph: false, useGhosting: false }
                  );

                  designExplorationService.updateNodeSnapshot('baseline', {
                    buildings: [managedBuilding],
                    metrics: {
                      spatialDaylightAutonomy: baselineResult.sda
                    },
                    daylightRun: {
                      status: 'complete',
                      studyId: baselineResult.studyId,
                      stage: baselineResult.stage,
                      sensorCount: baselineResult.sensorCount,
                      meanDF: baselineResult.meanDF,
                      updatedAt: baselineResult.completedAt || new Date().toISOString()
                    },
                    daylightResultsByBuildingId: {
                      [managedBuilding.id]: baselineResult
                    }
                  });
                } catch (error) {
                  designExplorationService.updateNodeSnapshot('baseline', {
                    buildings: [managedBuilding],
                    daylightRun: {
                      status: 'failed',
                      error: error instanceof Error ? error.message : 'Baseline simulation failed',
                      updatedAt: new Date().toISOString()
                    }
                  });
                  console.error('Baseline simulation failed:', error);
                } finally {
                  setIsBaselineSimRunning(false);
                }
              })();
            }
          } else {
            console.error('❌ Failed to add sample building to building manager');
          }
        } else {
          console.error('❌ Failed to create sample building');
        }
      } catch (error) {
        console.error('❌ Error creating sample building:', error);
      }
    }
  }, [isInitialized, scene, buildings.length, windowService, addBuilding, hasInitializedWithSample, runDaylightSimulation]);

  // Safeguard: Re-ensure sample building exists when switching to model tab
  useEffect(() => {
    if (activeTab === 'model' && isInitialized && scene && buildings.length === 0 && hasInitializedWithSample) {
      console.log('🔄 Sample building missing when switching to model tab, recreating...');
      
      // Reset the initialization flag to allow recreation
      setHasInitializedWithSample(false);
    }
  }, [activeTab, isInitialized, scene, buildings.length, hasInitializedWithSample]);
// End of sample building initialization

  // Define tabs
  const tabs = [
    { 
      id: 'weather', 
      label: 'Weather & Location',
      icon: '🌤️'
    },
    { 
      id: 'model', 
      label: 'Model',
      icon: '🏗️'
    }
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId as 'weather' | 'model');
    
    // When switching to model tab, ensure the Three.js canvas is properly sized and visible
    if (tabId === 'model' && containerRef.current) {
      // Force a resize event to ensure the renderer matches the container size
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        // Also ensure the canvas is properly visible
        const canvas = containerRef.current?.querySelector('canvas');
        if (canvas) {
          canvas.style.display = 'block';
        }
        
        // Debug: Check if buildings are still in the scene
        if (scene && buildings.length > 0) {
          console.log('Tab switch to model - Buildings status:', {
            buildingsCount: buildings.length,
            sceneChildren: scene.children.length,
            buildingIds: buildings.map(b => b.id)
          });
          
          // Ensure buildings are still visible in the scene
          buildings.forEach(building => {
            if (building.mesh.parent !== scene) {
              console.warn('Building mesh not in scene, re-adding:', building.id);
              scene.add(building.mesh);
              if (building.footprintOutline) scene.add(building.footprintOutline);
              if (building.floorLines) scene.add(building.floorLines);
            }
          });
        }
      }, 100);
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-950 flex flex-col">
      {/* Tab Navigation */}
      <Tabs 
        tabs={tabs} 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
      />
      
      <TabContent className="flex-1 relative">
        {/* Three.js Container - Always mounted but conditionally visible */}
        <div 
          ref={containerRef} 
          className={`w-full h-full ${activeTab === 'model' ? 'visible' : 'invisible'}`}
          style={{
            position: activeTab === 'model' ? 'relative' : 'absolute',
            zIndex: activeTab === 'model' ? 1 : -1,
            pointerEvents: activeTab === 'model' ? 'auto' : 'none'
          }}
        />
        
        {/* Weather Tab Content */}
        {activeTab === 'weather' && (
          <div className="absolute inset-0 z-10 pt-16">
            <WeatherAndLocationTab />
          </div>
        )}
        
        {/* Model Tab UI Elements - Only shown when model tab is active */}
        {activeTab === 'model' && (
          <>
            {/* Left Toolbar */}
            <LeftToolbar
              isDrawing={drawingState.isDrawing}
              isInitialized={isInitialized}
              hasBuildings={buildings.length > 0}
              onStartDrawing={handleStartDrawing}
              onShowConfig={() => setShowBuildingConfig(!showBuildingConfig)}
              onExport={exportBuildings}
              onClearAll={handleClearAll}
              onSaveConfiguration={handleSaveConfiguration}
              onImportConfiguration={handleImportConfiguration}
              onToggleSunController={() => setShowSunController(!showSunController)}
              onToggleTheme={handleToggleTheme}
            />

            {/* Bottom Toolbar */}
            <BottomToolbar
              showGrid={showGrid}
              snapToGrid={snapToGrid}
              showFPS={showFPS}
              buildingStats={buildingStats}
              currentCameraType={currentCameraType}
              onToggleGrid={handleToggleGrid}
              onToggleSnap={() => setSnapToGrid(!snapToGrid)}
              onToggleFPS={toggleFPSCounter}
              onSwitchCameraType={handleSwitchCameraType}
              onSetCameraView={handleSetCameraView}
            />

            {/* Floating Instructions */}
            <div className="absolute inset-0 pointer-events-none z-20">
              <FloatingInstructions
                mode={getInstructionMode()}
                drawingPoints={drawingState.points.length}
                buildingCount={buildings.length}
                onDismissWelcome={() => setHasInteracted(true)}
              />
            </div>

            {/* Building Tooltip */}
            {buildingTooltip && (
              <BuildingTooltip
                building={buildingTooltip.building}
                position={buildingTooltip.position}
                hasDaylightResult={Boolean(daylightResultsByBuildingId[buildingTooltip.building.id])}
                onViewResult={handleViewBuildingResult}
                onEdit={handleEditBuilding}
                onDelete={handleDeleteBuilding}
                onClose={hideBuildingTooltip}
              />
            )}

            {/* Building Configuration Panel */}
            {showBuildingConfig && (
              <BuildingConfigPanel
                config={buildingConfig}
                onConfigChange={setBuildingConfig}
                onClose={() => setShowBuildingConfig(false)}
              />
            )}

            {/* Sun Controller */}
            <SunController
              isOpen={showSunController}
              onToggle={() => setShowSunController(!showSunController)}
              onSunPositionChange={handleSunPositionChange}
            />

            {/* Building Edit Panel */}
            {selectedBuilding && (
              <BuildingEditPanel
                building={selectedBuilding}
                onClose={() => selectBuilding(null)}
                onPreview={handlePreviewBuilding}
                enableBuildingFocus={enableBuildingFocus}
                disableBuildingFocus={disableBuildingFocus}
              />
            )}

            {daylightLegend && (
              <div className="absolute right-4 bottom-20 z-30 pointer-events-none">
                <div className="bg-gray-900/90 border border-gray-700 rounded-lg p-3 min-w-[240px] shadow-xl">
                  {daylightLegend.mode === 'df' ? (
                    <>
                      <div className="text-xs font-semibold text-gray-200 mb-2">Daylight Factor (DF)</div>
                      <div className="h-3 rounded-md border border-gray-700" style={{
                        background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 10%, #06b6d4 20%, #22c55e 50%, #f59e0b 80%, #ef4444 100%)'
                      }} />
                      <div className="relative mt-1 h-4">
                        <span className="absolute left-0 text-[10px] text-gray-400">0%</span>
                        <span className="absolute text-[10px] text-gray-400 -translate-x-1/2" style={{ left: '10%' }}>1%</span>
                        <span className="absolute text-[10px] text-cyan-300 font-bold -translate-x-1/2" style={{ left: '20%' }}>2%</span>
                        <span className="absolute text-[10px] text-gray-400 -translate-x-1/2" style={{ left: '50%' }}>5%</span>
                        <span className="absolute right-0 text-[10px] text-gray-400">10%+</span>
                      </div>
                      <div className="flex justify-between mt-2 text-[10px]">
                        <span className="text-blue-400">Poor</span>
                        <span className="text-cyan-300">▲ 2% target</span>
                        <span className="text-orange-400">Overlit</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs font-semibold text-gray-200 mb-2">sDA (300 lux / 50%)</div>
                      <div className="h-3 rounded-md border border-gray-700" style={{
                        background: 'linear-gradient(90deg, #ef4444 0%, #f97316 55%, #22c55e 75%, #15803d 100%)'
                      }} />
                      <div className="relative mt-1 h-4">
                        <span className="absolute left-0 text-[10px] text-gray-400">0%</span>
                        <span className="absolute text-[10px] text-orange-300 font-bold -translate-x-1/2" style={{ left: '55%' }}>55%</span>
                        <span className="absolute text-[10px] text-emerald-300 font-bold -translate-x-1/2" style={{ left: '75%' }}>75%</span>
                        <span className="absolute right-0 text-[10px] text-gray-400">100%</span>
                      </div>
                      <div className="flex justify-between mt-2 text-[10px]">
                        <span className="text-red-400">Fails LEED</span>
                        <span className="text-orange-300">▲ nominal</span>
                        <span className="text-emerald-300">▲ enhanced</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Mini Graph Window */}
            <MiniGraphWindow onOpenFullGraph={handleOpenDesignGraph} />
          </>
        )}
      </TabContent>
      
      {/* Global Overlays and Dialogs */}
      {/* Loading Overlay */}
      {isInitializing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-900/95 rounded-2xl p-8 shadow-2xl border border-gray-700/50 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h3 className="text-white text-xl font-bold mb-2">Initializing 3D Scene</h3>
            <p className="text-gray-300 text-sm">Setting up WebGL renderer...</p>
          </div>
        </div>
      )}

      {/* Baseline Simulation Overlay */}
      {isBaselineSimRunning && !isInitializing && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-gray-900/95 rounded-2xl p-8 shadow-2xl border border-gray-700/50 text-center max-w-md">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <h3 className="text-white text-xl font-bold mb-2">Running Baseline Simulation</h3>
            <p className="text-gray-300 text-sm">Preparing daylight results for the startup building...</p>
            <div className="mt-4 bg-gray-800/70 border border-gray-700 rounded-lg p-3 text-left">
              <div className="text-xs text-gray-400">Status</div>
              <div className="text-sm text-cyan-300 capitalize">{activeDaylightRunStatus?.status || 'queued'}</div>
              <div className="text-xs text-gray-400 mt-2">Stage</div>
              <div className="text-sm text-gray-200">{activeDaylightRunStatus?.stage || 'Waiting for worker...'}</div>
              {activeDaylightRunStatus?.studyId && (
                <>
                  <div className="text-xs text-gray-400 mt-2">Study ID</div>
                  <div className="text-xs text-gray-200 break-all">{activeDaylightRunStatus.studyId}</div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daylight Simulation Overlay */}
      {isSaveAndRunInProgress && !isBaselineSimRunning && !isInitializing && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-gray-900/95 rounded-2xl p-8 shadow-2xl border border-gray-700/50 text-center max-w-md">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-4"></div>
            <h3 className="text-white text-xl font-bold mb-2">Running Daylight Simulation</h3>
            <p className="text-gray-300 text-sm">Preparing daylight results for the selected design...</p>
            <div className="mt-4 bg-gray-800/70 border border-gray-700 rounded-lg p-3 text-left">
              <div className="text-xs text-gray-400">Status</div>
              <div className="text-sm text-cyan-300 capitalize">{activeDaylightRunStatus?.status || 'queued'}</div>
              <div className="text-xs text-gray-400 mt-2">Stage</div>
              <div className="text-sm text-gray-200">{activeDaylightRunStatus?.stage || 'Waiting for worker...'}</div>
              {activeDaylightRunStatus?.studyId && (
                <>
                  <div className="text-xs text-gray-400 mt-2">Study ID</div>
                  <div className="text-xs text-gray-200 break-all">{activeDaylightRunStatus.studyId}</div>
                </>
              )}
              {daylightSimulationProgress && daylightSimulationProgress.total > 1 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Studies completed</span>
                    <span>{daylightSimulationProgress.completed}/{daylightSimulationProgress.total}</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-cyan-500 transition-all duration-300"
                      style={{ width: `${(daylightSimulationProgress.completed / daylightSimulationProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {activeDaylightRunStatus?.error && (
                <div className="mt-2 text-xs text-red-300 break-words">{activeDaylightRunStatus.error}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {initializationError && !isInitializing && (
        <div className="fixed inset-0 bg-red-900/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-red-900/95 rounded-2xl p-8 shadow-2xl border border-red-700/50 text-center max-w-md">
            <div className="text-red-400 text-4xl mb-4">⚠️</div>
            <h3 className="text-white text-xl font-bold mb-4">Scene Initialization Failed</h3>
            <p className="text-red-100 mb-6 text-sm">{initializationError}</p>
            <button
              onClick={retryInitialization}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg 
                        transition-all duration-200 font-medium shadow-lg"
            >
              Retry Initialization
            </button>
          </div>
        </div>
      )}

      {/* Save Configuration Dialog */}
      <SaveConfigurationDialog
        isOpen={showSaveConfigDialog}
        onClose={() => setShowSaveConfigDialog(false)}
        onSave={handleSaveConfigurationConfirm}
      />

      {/* Import Configuration Dialog */}
      <ImportConfigDialog
        isOpen={showImportConfigDialog}
        onClose={() => setShowImportConfigDialog(false)}
        onImport={handleImportConfigConfirm}
      />

      {/* Design Graph Dialog */}
      <DesignGraphDialog
        isOpen={showDesignGraphDialog}
        onClose={() => setShowDesignGraphDialog(false)}
        onReinstateConfiguration={handleReinstateConfiguration}
      />

      {activeResultsBuildingId && daylightResultsByBuildingId[activeResultsBuildingId] && (
        <DaylightResultsDialog
          isOpen={showDaylightResultsDialog}
          onClose={() => setShowDaylightResultsDialog(false)}
          buildingName={buildings.find((building) => building.id === activeResultsBuildingId)?.name || 'Selected Building'}
          result={daylightResultsByBuildingId[activeResultsBuildingId]}
          availableResults={buildings
            .filter((building) => Boolean(daylightResultsByBuildingId[building.id]))
            .map((building) => ({ id: building.id, name: building.name || 'Untitled Building' }))}
          selectedBuildingId={activeResultsBuildingId}
          onSelectBuildingResult={handleSelectBuildingResult}
          onApplyVisualization={(_, mode) => {
            if (!scene) {
              return;
            }
            // Always render all saved results for the given mode so the dialog
            // switching mode/building cannot accidentally replace the combined overlay
            // with a single building's points.
            const overlayGroups = getOverlayGroupsForResults(daylightResultsByBuildingId, mode);
            daylightVisualizationService.renderSensorPointGroups(scene, overlayGroups, mode);
            updateDaylightLegend(overlayGroups.flat(), mode);
          }}
        />
      )}
    </div>
  );
};