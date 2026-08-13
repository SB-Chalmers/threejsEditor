import React, { useRef, useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useThreeJS } from '../hooks/useThreeJS';
import { useDrawing } from '../hooks/useDrawing';
import { useClickHandler } from '../hooks/useClickHandler';
import { useBuildingManager } from '../hooks/useBuildingManager';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useBuildingEditSession } from '../hooks/useBuildingEditSession';
import { LeftToolbar } from './LeftToolbar';
import { BottomToolbar } from './BottomToolbar';
import { FloatingInstructions } from './FloatingInstructions';
import { BuildingEditPanel } from './BuildingEditPanel';
import { BuildingTooltip } from './BuildingTooltip';
import { SunController } from './SunController';
import { DesignGraphDialog } from './DesignGraphDialog';
import { SaveConfigurationDialog } from './dialogs/SaveConfigurationDialog';
import { ImportConfigDialog } from './dialogs/ImportConfigDialog';
import { DaylightResultsDialog } from './dialogs/DaylightResultsDialog';
import { Tabs, TabContent } from './ui/Tabs';
import { WeatherAndLocationTab } from './WeatherAndLocationTab';
import { BuildingConfig, BuildingData, BuildingModel } from '../types/building';
import type { CameraType, CameraView } from '../core/ThreeJSCore';
import type { SunPosition } from '../utils/sunPosition';
import { addSampleBuilding } from '../utils/addSampleBuilding';
import { BuildingService } from '../services/BuildingService';
import { designExplorationService } from '../services/DesignExplorationService';
import { daylightApiService } from '../services/DaylightApiService';
import { energyApiService } from '../services/EnergyApiService';
import { daylightVisualizationService, getOverlayDatasetsForResults } from '../services/DaylightVisualizationService';
import { getEPSMConstructionOptions, getCachedEPSMOptions, computePortfolioEmbodiedCarbon, calculateEmbodiedCarbon, resolveEnergyConstructions } from '../services/EPSMService';
import { DaylightRunSummary } from '../types/daylight';
import { createEnergyInputFingerprint, retainValidDaylightResults } from '../services/SimulationFingerprint';
import { DEFAULT_FACADE_PARAMETERS } from '../services/FacadeGeometry';
import { FootprintEditorService } from '../services/FootprintEditorService';
import { DrawingInspector } from './model/DrawingInspector';
import { SimulationProgressCard, type SimulationTaskState } from './model/SimulationProgressCard';
import { DaylightLegend } from './model/DaylightLegend';
import { DesignGraphOverviewCard } from './model/DesignGraphOverviewCard';
import { simulationCoordinator } from '../services/SimulationCoordinator';

type DaylightLegendState = {
  mode: 'df' | 'sda';
  isVisible: boolean;
};

type ImportedBuildingData = Partial<BuildingData> & { points: BuildingData['points'] };

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
  const [simulationProgress, setSimulationProgress] = useState<{ daylight: SimulationTaskState; energy: SimulationTaskState } | null>(null);
  const [daylightResultsByBuildingId, setDaylightResultsByBuildingId] = useState<Record<string, DaylightRunSummary>>({});
  const [daylightLegend, setDaylightLegend] = useState<DaylightLegendState | null>(null);
  const runAbortControllerRef = useRef<AbortController | null>(null);
  const energyAbortControllerRef = useRef<AbortController | null>(null);
  const footprintEditorRef = useRef<FootprintEditorService | null>(null);
  const selectedBuildingRef = useRef<BuildingData | null>(null);
  const suspendedAnalysisModeRef = useRef<'df' | 'sda' | null>(null);

  const lastRunNameRef = useRef('Design study');

  const updateDaylightLegend = React.useCallback((points: { value: number }[], mode: 'df' | 'sda', isVisible = true) => {
    setDaylightLegend(points.length > 0 ? { mode, isVisible } : null);
  }, []);

  useEffect(() => {
    if (!simulationProgress) return;
    const settled = [simulationProgress.daylight.status, simulationProgress.energy.status]
      .every(status => status === 'complete' || status === 'skipped');
    if (!settled) return;
    const timer = window.setTimeout(() => setSimulationProgress(null), 2000);
    return () => window.clearTimeout(timer);
  }, [simulationProgress]);

  const [buildingConfig, setBuildingConfig] = useState<BuildingConfig>({
    floors: 3,
    floorHeight: 3.5,
    color: 0x7C8FA3,
    window_to_wall_ratio: DEFAULT_FACADE_PARAMETERS.wwr,
    wall_construction: 'Default Wall',
    floor_construction: 'Default Floor',
    roof_construction: 'Default Roof',
    window_construction: 'Default Window',
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
    setSceneAppearanceMode,
    setCameraControlsEnabled
  } = useThreeJS(containerRef, showGrid);
    // Initialize building management
  const { 
    buildings, 
    selectedBuilding, 
    buildingTooltip,
    selectBuilding, 
    updateBuilding, 
    previewBuilding,
    restoreBuildingPreview,
    clearAllBuildings, 
    exportBuildings, 
    getBuildings,
    getBuilding,
    captureSnapshot,
    replaceWorkspace,
    workspaceRevision,
    buildingStats, 
    deleteBuilding, 
    handleBuildingInteraction,
    addBuilding,
    hideBuildingTooltip
  } = useBuildingManager(scene, camera as THREE.PerspectiveCamera | null, windowService);
  selectedBuildingRef.current = selectedBuilding;

  const buildingEdit = useBuildingEditSession({
    workspaceRevision,
    getBuilding,
    previewBuilding,
    updateBuilding,
    restoreBuildingPreview,
  });

  const showDaylightAnalysis = React.useCallback((
    results: Record<string, DaylightRunSummary>,
    mode: 'df' | 'sda'
  ): boolean => {
    if (!scene) return false;
    const datasets = getOverlayDatasetsForResults(results, mode);
    const points = datasets.flatMap((dataset) => dataset.points);
    if (datasets.length === 0) {
      daylightVisualizationService.clear(scene);
      setSceneAppearanceMode({ kind: 'normal' });
      updateDaylightLegend([], mode);
      return false;
    }
    daylightVisualizationService.renderDatasets(scene, datasets, mode);
    setSceneAppearanceMode({ kind: 'daylight-analysis' });
    updateDaylightLegend(points, mode, true);
    return true;
  }, [scene, setSceneAppearanceMode, updateDaylightLegend]);

  const refreshHiddenDaylightAnalysis = React.useCallback((
    results: Record<string, DaylightRunSummary>,
    mode: 'df' | 'sda'
  ) => {
    if (!scene) return;
    const datasets = getOverlayDatasetsForResults(results, mode);
    const points = datasets.flatMap((dataset) => dataset.points);
    if (datasets.length === 0) {
      daylightVisualizationService.clear(scene);
      setDaylightLegend(null);
    } else {
      daylightVisualizationService.renderDatasets(scene, datasets, mode);
      daylightVisualizationService.setVisible(scene, false);
      updateDaylightLegend(points, mode, false);
    }
    setSceneAppearanceMode({ kind: 'normal' });
  }, [scene, setSceneAppearanceMode, updateDaylightLegend]);

  const beginBuildingEdit = React.useCallback((building: BuildingData) => {
    const liveBuilding = getBuilding(building.id) ?? building;
    if (liveBuilding.mesh.userData.isPreview || liveBuilding.mesh.userData.isDrawingElement) return;

    suspendedAnalysisModeRef.current = daylightLegend?.isVisible
      ? daylightLegend.mode
      : null;
    if (scene && daylightLegend?.isVisible) {
      daylightVisualizationService.setVisible(scene, false);
      updateDaylightLegend(
        getOverlayDatasetsForResults(daylightResultsByBuildingId, daylightLegend.mode)
          .flatMap((dataset) => dataset.points),
        daylightLegend.mode,
        false
      );
    }
    setSceneAppearanceMode({ kind: 'normal' });
    selectBuilding(liveBuilding);
    buildingEdit.open(liveBuilding.id);
    setSceneAppearanceMode({ kind: 'editing', buildingId: liveBuilding.id });
  }, [
    buildingEdit.open,
    daylightLegend,
    daylightResultsByBuildingId,
    getBuilding,
    scene,
    selectBuilding,
    setSceneAppearanceMode,
    updateDaylightLegend,
  ]);

  useEffect(() => {
    if (!buildingEdit.buildingId || !buildingEdit.draft || !scene || !camera || !containerRef.current) return;
    const editor = new FootprintEditorService({
      scene,
      camera,
      element: containerRef.current,
      points: buildingEdit.draft.points,
      snapToGrid,
      onChange: buildingEdit.updateFootprint,
      onDragStateChange: dragging => setCameraControlsEnabled(!dragging),
    });
    footprintEditorRef.current = editor;
    return () => {
      editor.dispose();
      if (footprintEditorRef.current === editor) footprintEditorRef.current = null;
    };
  }, [buildingEdit.buildingId, buildingEdit.token, buildingEdit.updateFootprint, scene, camera, snapToGrid, setCameraControlsEnabled]);

  useEffect(() => {
    if (buildingEdit.draft) footprintEditorRef.current?.setPoints(buildingEdit.draft.points);
  }, [buildingEdit.draft]);

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
          beginBuildingEdit(result.building);
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
    setShowBuildingConfig(true);
    
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

  const handleImportConfigConfirm = (config: unknown) => {
    try {
      buildingEdit.discard();
      setSceneAppearanceMode({ kind: 'normal' });
      if (scene) daylightVisualizationService.clear(scene);
      setDaylightLegend(null);
      setDaylightResultsByBuildingId({});
      setShowDaylightResultsDialog(false);
      setActiveResultsBuildingId(null);
      suspendedAnalysisModeRef.current = null;
      // Clear current buildings
      clearAllBuildings();
      
      // Determine if config is an array of buildings or an object with buildings property
      const buildingsData: unknown[] = Array.isArray(config)
        ? config
        : (config && typeof config === 'object' && Array.isArray((config as { buildings?: unknown }).buildings)
          ? (config as { buildings: unknown[] }).buildings
          : []);
      
      if (!Array.isArray(buildingsData)) {
        throw new Error('Invalid configuration format');
      }

      // Recreate buildings from imported data
      const buildingService = new BuildingService(scene!);
      
      buildingsData.forEach((rawBuildingData, index: number) => {
        try {
          if (!rawBuildingData || typeof rawBuildingData !== 'object') {
            throw new Error(`Building ${index + 1}: Invalid building data`);
          }
          const buildingData = rawBuildingData as ImportedBuildingData;
          // Validate required fields
          if (!buildingData.points || !Array.isArray(buildingData.points) || buildingData.points.length < 3) {
            throw new Error(`Building ${index + 1}: Invalid or missing points`);
          }

          // Create building config with defaults for missing properties
          const buildingConfig: BuildingConfig = {
            floors: buildingData.floors ?? 3,
            floorHeight: buildingData.floorHeight ?? 3.5,
            color: buildingData.color ?? 0x7C8FA3,
            name: buildingData.name ?? `Imported Building ${index + 1}`,
            description: buildingData.description ?? '',
            window_to_wall_ratio: buildingData.window_to_wall_ratio ?? DEFAULT_FACADE_PARAMETERS.wwr,
            window_overhang: buildingData.window_overhang ?? false,
            window_overhang_depth: buildingData.window_overhang_depth ?? 0,
            wall_construction: buildingData.wall_construction ?? 'Default Wall',
            floor_construction: buildingData.floor_construction ?? 'Default Floor',
            roof_construction: buildingData.roof_construction ?? 'Default Roof',
            window_construction: buildingData.window_construction ?? 'Default Window',
            structural_system: buildingData.structural_system ?? 'Concrete',
            building_program: buildingData.building_program ?? 'Office',
            hvac_system: buildingData.hvac_system ?? 'Default HVAC',
            natural_ventilation: buildingData.natural_ventilation ?? false
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
          addBuilding(mesh, buildingData.points, buildingConfig);
          
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
    targetBuilding: BuildingModel,
    configurationName: string,
    buildingsForSnapshot?: BuildingModel[],
    options?: { recordInGraph?: boolean; useGhosting?: boolean; location?: string }
  ) => {
    const snapshotBuildings = buildingsForSnapshot && buildingsForSnapshot.length > 0
      ? buildingsForSnapshot
      : buildings;

    if (!scene || !targetBuilding || snapshotBuildings.length === 0) {
      throw new Error('At least one building is required to run daylight analysis.');
    }

    const now = new Date().toISOString();
    const configuredLocation = import.meta.env.VITE_DAYLIGHT_API_LOCATION as string | undefined;
    const resolvedLocation = options?.location || configuredLocation || await daylightApiService.getDefaultLocation(runAbortControllerRef.current?.signal);
    const runSda = Boolean(resolvedLocation);
    const shouldRecordInGraph = options?.recordInGraph !== false;
    const useGhosting = options?.useGhosting !== false;

    const graph = designExplorationService.getGraph();
    const baselineNode = graph.nodes.find(node => node.id === 'baseline');
    const baselineHasDaylight = Boolean(
      baselineNode?.daylightRun && baselineNode.daylightRun.status !== 'idle'
    );
    const baselineHasResults = Boolean(
      baselineNode?.daylightResultsByBuildingId &&
      Object.keys(baselineNode.daylightResultsByBuildingId).length > 0
    );
    const shouldStoreFirstRunOnBaseline = Boolean(
      shouldRecordInGraph &&
      baselineNode &&
      graph.nodes.length === 1 &&
      graph.currentNodeId === 'baseline' &&
      !baselineHasDaylight &&
      !baselineHasResults
    );

    const initialMetrics = {
      spatialDaylightAutonomy: 0,
      globalWarmingPotential: (() => {
        try {
          const epsmOpts = getCachedEPSMOptions();
          if (!epsmOpts) return 0;
          const gwp = computePortfolioEmbodiedCarbon(epsmOpts, snapshotBuildings);
          return gwp ?? 0;
        } catch {
          return 0;
        }
      })()
    };

    let pendingNodeId: string | null = null;
    if (shouldStoreFirstRunOnBaseline) {
      designExplorationService.updateNodeSnapshot('baseline', {
        buildings: snapshotBuildings,
        metrics: initialMetrics,
        daylightRun: {
          status: 'queued',
          updatedAt: now
        },
        daylightResultsByBuildingId
      });
      pendingNodeId = 'baseline';
    } else if (shouldRecordInGraph) {
      const pendingNode = designExplorationService.saveConfiguration(
        snapshotBuildings,
        configurationName,
        initialMetrics,
        {
          status: 'queued',
          updatedAt: now
        },
        daylightResultsByBuildingId
      );
      pendingNodeId = pendingNode.id;
    }

    runAbortControllerRef.current?.abort();
    runAbortControllerRef.current = new AbortController();
    setIsSaveAndRunInProgress(true);
    setSimulationProgress(previous => ({
      daylight: { status: 'queued', message: 'Submitting daylight studies…' },
      energy: previous?.energy ?? { status: 'preparing', message: 'Validating constructions…' },
    }));

    // Ghosting is used for user-triggered runs, but can be disabled for baseline startup runs.
    setSceneAppearanceMode(useGhosting
      ? { kind: 'editing', buildingId: '__daylight_overlay__' }
      : { kind: 'normal' });
    daylightVisualizationService.clear(scene);

    try {
      const resultsById = await simulationCoordinator.runDaylightStudySet({
        buildings: snapshotBuildings,
        location: resolvedLocation,
        signal: runAbortControllerRef.current.signal,
        onStatus: (building, { status, studyId, stage, error }) => {
                setSimulationProgress(previous => previous ? {
                  ...previous,
                  daylight: {
                    status: status === 'failed' ? 'failed' : status === 'complete' ? 'complete' : status === 'queued' ? 'queued' : 'running',
                    message: error || `${building.name || 'Building'}: ${stage || status}`,
                  },
                } : previous);

                if (pendingNodeId) {
                  designExplorationService.updateNode(pendingNodeId, {
                    daylightRun: {
                      status,
                      studyId,
                      stage,
                      error,
                      updatedAt: new Date().toISOString()
                    }
                  });
                }
        },
      });
      const stampedResults = snapshotBuildings.map(building => resultsById[building.id]);
      const result = resultsById[targetBuilding.id];

      setDaylightResultsByBuildingId((prev) => ({ ...prev, ...resultsById }));
      showDaylightAnalysis({ ...daylightResultsByBuildingId, ...resultsById }, 'df');

      if (pendingNodeId) {
        designExplorationService.updateNode(pendingNodeId, {
          ...(runSda
            ? {
                metrics: {
                  spatialDaylightAutonomy:
                    stampedResults.reduce((total, current) => total + current.sda, 0) / stampedResults.length
                }
              }
            : {}),
          daylightRun: {
            status: 'complete',
            studyId: result.studyId,
            stage: result.stage,
            sensorCount: stampedResults.reduce((total, current) => total + current.sensorCount, 0),
            meanDF: stampedResults.reduce((total, current) => total + current.meanDF, 0) / stampedResults.length,
            updatedAt: result.completedAt || new Date().toISOString()
          },
          daylightResultsByBuildingId: resultsById
        });
      }

      setSimulationProgress(previous => previous ? { ...previous, daylight: { status: 'complete', message: 'Daylight results are ready.' } } : previous);

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown daylight simulation error';
      setSimulationProgress(previous => previous ? { ...previous, daylight: { status: 'failed', message } } : previous);

      if (pendingNodeId) {
        designExplorationService.updateNode(pendingNodeId, {
          daylightRun: {
            status: 'failed',
            error: message,
            updatedAt: new Date().toISOString()
          }
        });
      }

      daylightVisualizationService.clear(scene);
      setSceneAppearanceMode({ kind: 'normal' });
      setDaylightLegend(null);

      throw error;
    } finally {
      runAbortControllerRef.current = null;
    }
  }, [scene, buildings, daylightResultsByBuildingId, setSceneAppearanceMode, showDaylightAnalysis]);

  const handleSaveConfigurationConfirm = async (name: string) => {
    const runSnapshot = captureSnapshot();
    const targetBuilding = runSnapshot.find(building => building.id === selectedBuildingRef.current?.id)
      ?? runSnapshot[0];
    if (!targetBuilding) {
      throw new Error('At least one building is required to run daylight analysis.');
    }

    lastRunNameRef.current = name;
    setSimulationProgress({
      daylight: { status: 'preparing', message: 'Preparing geometry…' },
      energy: { status: 'preparing', message: 'Validating EPSM constructions…' },
    });

    const [location, epsmOpts] = await Promise.all([
      daylightApiService.getDefaultLocation().catch(() => undefined),
      getEPSMConstructionOptions().catch(() => null),
    ]);

    energyAbortControllerRef.current?.abort();
    energyAbortControllerRef.current = new AbortController();
    let energyResult: Awaited<ReturnType<typeof energyApiService.runEnergyStudy>> | null = null;

    const daylightPromise = runDaylightSimulation(targetBuilding, name, runSnapshot, { location });
    const energyPromise = (async () => {
      if (!location) throw new Error('Energy requires a configured simulation location.');
      setSimulationProgress(previous => previous ? { ...previous, energy: { status: 'queued', message: 'Submitting energy study…' } } : previous);
      const coordinated = await simulationCoordinator.runEnergyStudy({
        building: targetBuilding,
        location,
        epsm: epsmOpts,
        signal: energyAbortControllerRef.current.signal,
        callbacks: {
          onQueued: () => setSimulationProgress(previous => previous ? { ...previous, energy: { status: 'queued', message: 'Waiting for an energy worker…' } } : previous),
          onStatusUpdate: status => setSimulationProgress(previous => previous ? { ...previous, energy: { status: 'running', message: status.stage ?? status.status } } : previous),
          onComplete: (result) => {
            energyResult = result;
            setSimulationProgress(previous => previous ? { ...previous, energy: { status: 'complete', message: 'Energy results are ready.' } } : previous);
          },
          onError: error => setSimulationProgress(previous => previous ? { ...previous, energy: { status: 'failed', message: error.message } } : previous),
        },
      });
      energyResult = coordinated.result;
      return coordinated.result;
    })().catch(error => {
      const message = error instanceof Error ? error.message : 'Energy simulation failed.';
      setSimulationProgress(previous => previous ? { ...previous, energy: { status: 'failed', message } } : previous);
      throw error;
    });

    const [, energySettled] = await Promise.allSettled([daylightPromise, energyPromise]);
    setIsSaveAndRunInProgress(false);
    const node = designExplorationService.getCurrentNode();
    if (node && energySettled.status === 'fulfilled' && energyResult) {
      const resolvedConstructions = resolveEnergyConstructions(epsmOpts, {
        wall: targetBuilding.wall_construction, floor: targetBuilding.floor_construction,
        roof: targetBuilding.roof_construction, window: targetBuilding.window_construction,
      });
      const resolved = {
        ...targetBuilding,
        wall_construction: resolvedConstructions.wall,
        floor_construction: resolvedConstructions.floor,
        roof_construction: resolvedConstructions.roof,
        window_construction: resolvedConstructions.window,
      };
      const gwp = epsmOpts ? (computePortfolioEmbodiedCarbon(epsmOpts, [resolved]) ?? 0) : 0;
      const wallArea = resolved.metrics.perimeter * resolved.metrics.totalHeight;
      const windowArea = wallArea * (resolved.window_to_wall_ratio ?? DEFAULT_FACADE_PARAMETERS.wwr);
      const breakdown = epsmOpts ? calculateEmbodiedCarbon(epsmOpts, resolvedConstructions, {
        wallArea, windowArea, floorArea: resolved.metrics.grossFloorArea, roofArea: resolved.metrics.footprintArea,
      }) : null;
      designExplorationService.updateNode(node.id, {
        energyRun: {
          status: 'complete', inputFingerprint: createEnergyInputFingerprint(targetBuilding),
          studyId: energyResult.study_id, monthlyHeatBalance: energyResult.monthly_heat_balance ?? undefined,
        },
        metrics: {
          heatingDemand: energyResult.heating_demand_kwh_m2,
          coolingDemand: energyResult.cooling_demand_kwh_m2,
          totalEnergy: energyResult.total_energy_kwh_m2,
          ...(gwp > 0 ? { globalWarmingPotential: gwp } : {}),
          ...(breakdown ? { embodiedCarbonBreakdown: breakdown } : {}),
        },
      });
    } else if (node && energySettled.status === 'rejected') {
      designExplorationService.updateNode(node.id, {
        energyRun: { status: 'failed', error: energySettled.reason instanceof Error ? energySettled.reason.message : 'Energy simulation failed.' },
      });
    }
  };

  const handleOpenDesignGraph = () => {
    setShowDesignGraphDialog(true);
  };

  const handleReinstateConfiguration = (nodeId: string) => {
    runAbortControllerRef.current?.abort();
    energyAbortControllerRef.current?.abort();

    const node = designExplorationService.reinstateConfiguration(nodeId);

    // Reset transient UI/editing state so reinstatement is deterministic.
    stopDrawing();
    clearAllDrawingElements();
    buildingEdit.discard();
    setShowBuildingConfig(false);
    hideBuildingTooltip();

    setSceneAppearanceMode({ kind: 'normal' });
    if (scene) daylightVisualizationService.clear(scene);
    suspendedAnalysisModeRef.current = null;
    selectBuilding(null);
    setShowDaylightResultsDialog(false);
    setActiveResultsBuildingId(null);
    setDaylightLegend(null);
    if (node && scene) {
      replaceWorkspace(node.buildings);

      const reinstatedResults = node.daylightResultsByBuildingId || {};
      setDaylightResultsByBuildingId(reinstatedResults);

      suspendedAnalysisModeRef.current = null;
      refreshHiddenDaylightAnalysis(reinstatedResults, 'df');
      setSceneAppearanceMode({ kind: 'normal' });

      console.log('Configuration reinstated:', node.name, `(${node.buildings.length} buildings)`);
    }
    setShowDesignGraphDialog(false);
  };

  const handleCommitBuilding = () => {
    const resumeMode = suspendedAnalysisModeRef.current;
    suspendedAnalysisModeRef.current = null;
    setSceneAppearanceMode({ kind: 'normal' });
    const updatedBuilding = buildingEdit.commit();
    if (!updatedBuilding) return;
    const retained = retainValidDaylightResults(daylightResultsByBuildingId, getBuildings());
    selectBuilding(null);
    setDaylightResultsByBuildingId(retained);

    if (activeResultsBuildingId && !retained[activeResultsBuildingId]) {
      setActiveResultsBuildingId(null);
      setShowDaylightResultsDialog(false);
    }

    if (resumeMode) {
      showDaylightAnalysis(retained, resumeMode);
    } else if (daylightLegend) {
      refreshHiddenDaylightAnalysis(retained, daylightLegend.mode);
    } else if (Object.keys(retained).length === 0 && scene) {
      daylightVisualizationService.clear(scene);
    }
  };

  const handleCancelBuilding = () => {
    const resumeMode = suspendedAnalysisModeRef.current;
    suspendedAnalysisModeRef.current = null;
    setSceneAppearanceMode({ kind: 'normal' });
    buildingEdit.cancel();
    selectBuilding(null);
    if (resumeMode) showDaylightAnalysis(daylightResultsByBuildingId, resumeMode);
  };

  const handleEditBuilding = beginBuildingEdit;

  const handleViewBuildingResult = (building: BuildingData) => {
    if (!scene) {
      return;
    }

    const result = daylightResultsByBuildingId[building.id];
    if (!result) {
      return;
    }

    showDaylightAnalysis(daylightResultsByBuildingId, 'df');
    setActiveResultsBuildingId(building.id);
    setShowDaylightResultsDialog(true);
  };

  const handleSelectBuildingResult = (buildingId: string) => {
    const result = daylightResultsByBuildingId[buildingId];
    if (!result || !scene) {
      return;
    }

    showDaylightAnalysis(daylightResultsByBuildingId, 'df');
    setActiveResultsBuildingId(buildingId);
  };

  const handleDeleteBuilding = (buildingId: string) => {
    if (buildingEdit.buildingId === buildingId) {
      buildingEdit.discard();
    }
    setSceneAppearanceMode({ kind: 'normal' });
    deleteBuilding(buildingId);
    const nextResults = { ...daylightResultsByBuildingId };
    delete nextResults[buildingId];
    setDaylightResultsByBuildingId(nextResults);
    if (daylightLegend?.isVisible) {
      showDaylightAnalysis(nextResults, daylightLegend.mode);
    } else if (daylightLegend) {
      refreshHiddenDaylightAnalysis(nextResults, daylightLegend.mode);
    }

    if (activeResultsBuildingId === buildingId) {
      setShowDaylightResultsDialog(false);
      setActiveResultsBuildingId(null);
    }
  };

  const handleClearAll = () => {
    buildingEdit.discard();
    setSceneAppearanceMode({ kind: 'normal' });
    selectBuilding(null);
    clearAllBuildings();
    setDaylightResultsByBuildingId({});
    setShowDaylightResultsDialog(false);
    setActiveResultsBuildingId(null);
    setDaylightLegend(null);
    suspendedAnalysisModeRef.current = null;
    if (scene) {
      daylightVisualizationService.clear(scene);
    }
    // Don't clear drawing elements when using the Clear All button from LeftToolbar
    // Only clear selected building and reset UI state
    // Force service state reset
    setTimeout(() => {
      if (showBuildingConfig) setShowBuildingConfig(false);
    }, 100);
  };

  const handleToggleDaylightVisibility = () => {
    if (!scene || !daylightLegend) return;
    if (daylightLegend.isVisible) {
      daylightVisualizationService.setVisible(scene, false);
      setSceneAppearanceMode({ kind: 'normal' });
      setDaylightLegend({ ...daylightLegend, isVisible: false });
      return;
    }
    showDaylightAnalysis(daylightResultsByBuildingId, daylightLegend.mode);
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
    if (!hasInteracted && !drawingState.isDrawing && buildings.length > 0 && !selectedBuilding && !showBuildingConfig) {
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
      setShowBuildingConfig(true);
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
      return;
    },
    onExport: () => {
      if (activeTab !== 'model') return;
      exportBuildings();
    },
    onClearAll: () => {
      if (activeTab !== 'model') return;
      handleClearAll();
      if (clearAllDrawingElements) clearAllDrawingElements();
    },
    onEscape: () => {
      if (activeTab !== 'model') return;
      if (drawingState.isDrawing) {
        stopDrawing();
      } else if (selectedBuilding) {
        handleCancelBuilding();
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
    isDrawing: drawingState.isDrawing,
    isInitialized
  });

  useEffect(() => {
    return () => {
      runAbortControllerRef.current?.abort();
      if (scene) {
        daylightVisualizationService.clear(scene);
      }
      setSceneAppearanceMode({ kind: 'normal' });
    };
  }, [scene, setSceneAppearanceMode]);

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
          color: 0x7C8FA3,
          name: 'Welcome Room (10m x 5m)',
          description: 'A 10m x 5m starter room with 6 storeys',
          windowToWallRatio: 0.4
        });

        if (sampleBuilding) {
          // Add the building to the building manager
          const managedBuilding = addBuilding(
            sampleBuilding.mesh,
            sampleBuilding.points,
            {
              floors: sampleBuilding.floors,
              floorHeight: sampleBuilding.floorHeight,
              color: sampleBuilding.color ?? 0x7C8FA3,
              name: sampleBuilding.name,
              description: sampleBuilding.description,
              window_to_wall_ratio: sampleBuilding.window_to_wall_ratio,
              window_overhang: sampleBuilding.window_overhang,
              window_overhang_depth: sampleBuilding.window_overhang_depth,
              wall_construction: sampleBuilding.wall_construction,
              floor_construction: sampleBuilding.floor_construction,
              roof_construction: sampleBuilding.roof_construction,
              window_construction: sampleBuilding.window_construction,
              structural_system: sampleBuilding.structural_system,
              building_program: sampleBuilding.building_program,
              hvac_system: sampleBuilding.hvac_system,
              natural_ventilation: sampleBuilding.natural_ventilation
            }
          );

          if (managedBuilding) {
            console.log('✅ Sample room building added successfully:', managedBuilding.id);
            
            // Mark that we've initialized with a sample building
            setHasInitializedWithSample(true);

            designExplorationService.updateNodeSnapshot('baseline', {
              buildings: [managedBuilding],
              daylightRun: { status: 'idle' },
              energyRun: { status: 'idle' },
              daylightResultsByBuildingId: {},
            });
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
  }, [isInitialized, scene, buildings.length, windowService, addBuilding, hasInitializedWithSample]);

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
    <div className="model-workspace relative flex h-screen w-full flex-col bg-[#F4F6F8] text-slate-800">
      {/* Tab Navigation */}
      <Tabs 
        tabs={tabs} 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
      />
      
      <TabContent className="relative">
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
          <div className="absolute inset-0 z-10 overflow-y-auto">
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
              onExport={exportBuildings}
              onClearAll={handleClearAll}
              onSaveConfiguration={handleSaveConfiguration}
              onImportConfiguration={handleImportConfiguration}
              onToggleSunController={() => setShowSunController(!showSunController)}
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
              onOpenDesignGraph={handleOpenDesignGraph}
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

            {drawingState.isDrawing && showBuildingConfig && (
              <DrawingInspector
                config={buildingConfig}
                onChange={setBuildingConfig}
                onClose={() => { setShowBuildingConfig(false); stopDrawing(); }}
              />
            )}

            {/* Sun Controller */}
            <SunController
              isOpen={showSunController}
              onToggle={() => setShowSunController(!showSunController)}
              onSunPositionChange={handleSunPositionChange}
            />

            {/* Building Edit Panel */}
            {buildingEdit.draft && buildingEdit.baseDraft && (
              <BuildingEditPanel
                key={`${buildingEdit.buildingId}-${buildingEdit.token}`}
                draft={buildingEdit.draft}
                baseDraft={buildingEdit.baseDraft}
                onChange={buildingEdit.updateDraft}
                onReset={buildingEdit.reset}
                onCommit={handleCommitBuilding}
                onCancel={handleCancelBuilding}
              />
            )}

            {daylightLegend && <DaylightLegend {...daylightLegend} onToggle={handleToggleDaylightVisibility} />}

            <DesignGraphOverviewCard onOpenGraph={handleOpenDesignGraph} />

            {simulationProgress && <SimulationProgressCard daylight={simulationProgress.daylight} energy={simulationProgress.energy} onDismiss={() => setSimulationProgress(null)} onRetry={() => void handleSaveConfigurationConfirm(lastRunNameRef.current)} />}

          </>
        )}
      </TabContent>
      
      {/* Global Overlays and Dialogs */}
      {/* Loading Overlay */}
      {isInitializing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/70 backdrop-blur-sm">
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 text-center shadow-xl">
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-blue-600" />
            <h3 className="text-[13px] font-semibold text-slate-900">Initializing 3D scene</h3>
            <p className="mt-1 text-[11px] text-slate-500">Setting up the WebGL renderer…</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {initializationError && !isInitializing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/70 backdrop-blur-sm">
          <div className="max-w-sm rounded-lg border border-rose-200 bg-white p-6 text-center shadow-xl">
            <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-rose-600" />
            <h3 className="text-[13px] font-semibold text-slate-900">Scene initialization failed</h3>
            <p className="mb-5 mt-2 text-[11px] leading-5 text-slate-600">{initializationError}</p>
            <button
              onClick={retryInitialization}
              className="h-8 w-full rounded-md bg-rose-600 px-4 text-[11px] font-semibold text-white hover:bg-rose-700"
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
        energySimAvailable={true}
        onRunEnergySimulation={async (nodeId) => {
          const node = designExplorationService.getGraph().nodes.find(n => n.id === nodeId);
          if (!node || node.buildings.length === 0) return;
          const building = node.buildings[0];

          // Fetch location and EPSM options in parallel before submitting
          const [location, epsmOpts] = await Promise.all([
            daylightApiService.getDefaultLocation().catch(() => undefined),
            getEPSMConstructionOptions().catch(() => null),
          ]);
          if (!location) return;

          energyAbortControllerRef.current?.abort();
          energyAbortControllerRef.current = new AbortController();

          designExplorationService.updateNode(nodeId, {
            energyRun: { status: 'queued', stage: 'Submitting…' }
          });

          try {
            const resolvedConstructions = resolveEnergyConstructions(epsmOpts, {
              wall: building.wall_construction,
              floor: building.floor_construction,
              roof: building.roof_construction,
              window: building.window_construction,
            });
            await energyApiService.runEnergyStudy(
              building,
              {
                constructions: resolvedConstructions,
                building_program: building.building_program ?? 'Office',
                hvac_system:      building.hvac_system      ?? 'Default HVAC',
                natural_ventilation: building.natural_ventilation ?? false,
                location,
              },
              {
                onQueued: (studyId) => designExplorationService.updateNode(nodeId, {
                  energyRun: { status: 'queued', studyId, stage: 'Queued' }
                }),
                onStatusUpdate: (s) => designExplorationService.updateNode(nodeId, {
                  energyRun: { status: s.status, stage: s.stage }
                }),
                onComplete: (result) => {
                  const resolvedForGwp = {
                    ...building,
                    wall_construction: resolvedConstructions.wall,
                    floor_construction: resolvedConstructions.floor,
                    roof_construction: resolvedConstructions.roof,
                    window_construction: resolvedConstructions.window,
                  };
                  const gwp = epsmOpts ? (computePortfolioEmbodiedCarbon(epsmOpts, [resolvedForGwp]) ?? 0) : 0;
                  const wwr = resolvedForGwp.window_to_wall_ratio ?? DEFAULT_FACADE_PARAMETERS.wwr;
                  const wallArea = resolvedForGwp.metrics.perimeter * resolvedForGwp.metrics.totalHeight;
                  const breakdown = epsmOpts ? calculateEmbodiedCarbon(
                    epsmOpts,
                    { wall: resolvedForGwp.wall_construction ?? '', floor: resolvedForGwp.floor_construction ?? '', roof: resolvedForGwp.roof_construction ?? '', window: resolvedForGwp.window_construction ?? '' },
                    { wallArea, windowArea: wallArea * wwr, floorArea: resolvedForGwp.metrics.grossFloorArea, roofArea: resolvedForGwp.metrics.footprintArea }
                  ) : null;
                  designExplorationService.updateNode(nodeId, {
                    energyRun: {
                      status: 'complete',
                      inputFingerprint: createEnergyInputFingerprint(building),
                      studyId: result.study_id,
                      monthlyHeatBalance: result.monthly_heat_balance ?? undefined,
                    },
                    metrics: {
                      heatingDemand: result.heating_demand_kwh_m2,
                      coolingDemand: result.cooling_demand_kwh_m2,
                      totalEnergy:   result.total_energy_kwh_m2,
                      ...(gwp > 0 ? { globalWarmingPotential: gwp } : {}),
                      ...(breakdown ? { embodiedCarbonBreakdown: breakdown } : {}),
                    }
                  });
                },
                onError: (err) => designExplorationService.updateNode(nodeId, {
                  energyRun: { status: 'failed', error: err.message }
                }),
              },
              energyAbortControllerRef.current.signal
            );
          } catch (err) {
            if (err instanceof Error && err.message !== 'Energy study aborted') {
              designExplorationService.updateNode(nodeId, {
                energyRun: { status: 'failed', error: (err as Error).message }
              });
            }
          }
        }}
      />

      {activeResultsBuildingId && daylightResultsByBuildingId[activeResultsBuildingId] && (
        <DaylightResultsDialog
          isOpen={showDaylightResultsDialog}
          onClose={() => setShowDaylightResultsDialog(false)}
          buildingName={buildings.find((building) => building.id === activeResultsBuildingId)?.name || 'Selected Building'}
          result={daylightResultsByBuildingId[activeResultsBuildingId]}
          energyResults={(() => {
            const node = designExplorationService.getCurrentNode();
            if (!node) return undefined;
            const simulatedBuildingId = node.buildings[0]?.id;
            const currentSimulatedBuilding = buildings.find(building => building.id === simulatedBuildingId);
            const isCurrent = Boolean(
              currentSimulatedBuilding &&
              node.energyRun?.inputFingerprint &&
              node.energyRun.inputFingerprint === createEnergyInputFingerprint(currentSimulatedBuilding)
            );
            if (!isCurrent) {
              return { status: 'idle' as const };
            }
            return {
              heatingDemand: node.metrics.heatingDemand,
              coolingDemand: node.metrics.coolingDemand,
              totalEnergy:   node.metrics.totalEnergy,
              globalWarmingPotential: node.metrics.globalWarmingPotential,
              embodiedCarbonBreakdown: node.metrics.embodiedCarbonBreakdown,
              monthlyHeatBalance: node.energyRun?.monthlyHeatBalance,
              status: node.energyRun?.status ?? 'idle',
            };
          })()}
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
            showDaylightAnalysis(daylightResultsByBuildingId, mode);
          }}
        />
      )}
    </div>
  );
};
