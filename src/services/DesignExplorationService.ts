import { DaylightRunMetadata, DesignNode, DesignExplorationGraph, DesignMetrics } from '../types/designExploration';
import { BuildingData } from '../types/building';
import { DaylightRunSummary } from '../types/daylight';

class DesignExplorationService {
  private graph: DesignExplorationGraph = {
    nodes: [],
    edges: [],
    currentNodeId: undefined
  };

  private listeners: Array<(graph: DesignExplorationGraph) => void> = [];

  constructor() {
    // Don't load from storage - start fresh each session
    this.createBaselineNode();
  }

  // Create the initial baseline node
  private createBaselineNode() {
    if (this.graph.nodes.length === 0) {
      const baselineNode: DesignNode = {
        id: 'baseline',
        timestamp: new Date(),
        name: 'Baseline',
        buildings: [],
        metrics: this.generateDummyMetrics(),
        position: { x: 0, y: 0 }
      };
      this.graph.nodes.push(baselineNode);
      this.graph.currentNodeId = 'baseline';
      // Don't persist to storage - graph resets on page reload
    }
  }

  // Generate dummy metrics for demonstration (replace with real calculations)
  private generateDummyMetrics(): DesignMetrics {
    return {
      heatingDemand: Math.round((Math.random() * 50 + 20) * 100) / 100, // 20-70 kWh/m²/year
      spatialDaylightAutonomy: Math.round((Math.random() * 40 + 40) * 100) / 100, // 40-80%
      globalWarmingPotential: Math.round((Math.random() * 200 + 100) * 100) / 100 // 100-300 kg CO2 eq/m²
    };
  }

  // Save current configuration as a new node
  saveConfiguration(
    buildings: BuildingData[],
    name?: string,
    metricsOverride?: Partial<DesignMetrics>,
    daylightRun?: DaylightRunMetadata,
    daylightResultsByBuildingId?: Record<string, DaylightRunSummary>
  ): DesignNode {
    const nodeId = `node_${Date.now()}`;
    const parentId = this.graph.currentNodeId;
    const defaultMetrics = this.generateDummyMetrics();
    
    const newNode: DesignNode = {
      id: nodeId,
      timestamp: new Date(),
      name: name || `Design ${this.graph.nodes.length}`,
      buildings: this.cloneBuildings(buildings),
      metrics: {
        ...defaultMetrics,
        ...(metricsOverride || {})
      },
      daylightRun,
      daylightResultsByBuildingId: daylightResultsByBuildingId ? { ...daylightResultsByBuildingId } : undefined,
      parentId: parentId,
      position: this.calculateNodePosition(parentId)
    };

    this.graph.nodes.push(newNode);
    
    if (parentId) {
      this.graph.edges.push({ from: parentId, to: nodeId });
    }

    this.graph.currentNodeId = nodeId;
    // Don't persist to storage - graph resets on page reload
    this.notifyListeners();
    
    return newNode;
  }

  updateNode(
    nodeId: string,
    updates: {
      metrics?: Partial<DesignMetrics>;
      daylightRun?: DaylightRunMetadata;
      daylightResultsByBuildingId?: Record<string, DaylightRunSummary>;
    }
  ): DesignNode | null {
    const node = this.graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return null;
    }

    if (updates.metrics) {
      node.metrics = {
        ...node.metrics,
        ...updates.metrics
      };
    }

    if (updates.daylightRun) {
      node.daylightRun = updates.daylightRun;
    }

    if (updates.daylightResultsByBuildingId) {
      node.daylightResultsByBuildingId = {
        ...(node.daylightResultsByBuildingId || {}),
        ...updates.daylightResultsByBuildingId
      };
    }

    this.notifyListeners();
    return node;
  }

  updateNodeSnapshot(
    nodeId: string,
    updates: {
      buildings?: BuildingData[];
      metrics?: Partial<DesignMetrics>;
      daylightRun?: DaylightRunMetadata;
      daylightResultsByBuildingId?: Record<string, DaylightRunSummary>;
    }
  ): DesignNode | null {
    const node = this.graph.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return null;
    }

    if (updates.buildings) {
      node.buildings = this.cloneBuildings(updates.buildings);
    }

    if (updates.metrics) {
      node.metrics = {
        ...node.metrics,
        ...updates.metrics
      };
    }

    if (updates.daylightRun) {
      node.daylightRun = updates.daylightRun;
    }

    if (updates.daylightResultsByBuildingId) {
      node.daylightResultsByBuildingId = {
        ...(updates.daylightResultsByBuildingId || {})
      };
    }

    this.notifyListeners();
    return node;
  }

  // Calculate position for new node in graph layout
  private calculateNodePosition(parentId?: string): { x: number; y: number } {
    if (!parentId) return { x: 0, y: 0 };
    
    const parent = this.graph.nodes.find(n => n.id === parentId);
    if (!parent || !parent.position) return { x: 0, y: 0 };

    // Simple layout: place children in a circle around parent
    const childrenCount = this.graph.edges.filter(e => e.from === parentId).length;
    const angle = (childrenCount * Math.PI * 2) / 8; // Max 8 children in circle
    const radius = 150;
    
    return {
      x: parent.position.x + Math.cos(angle) * radius,
      y: parent.position.y + Math.sin(angle) * radius
    };
  }

  // Clone buildings data (without Three.js objects)
  private cloneBuildings(buildings: BuildingData[]): BuildingData[] {
    return buildings.map(building => ({
      ...building,
      mesh: building.mesh, // Keep reference for now, might need to serialize differently
      footprintOutline: building.footprintOutline,
      floorLines: building.floorLines
    }));
  }

  // Reinstate a configuration
  reinstateConfiguration(nodeId: string): DesignNode | null {
    const node = this.graph.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    this.graph.currentNodeId = nodeId;
    // Don't persist to storage - graph resets on page reload
    this.notifyListeners();
    
    return node;
  }

  // Get current graph
  getGraph(): DesignExplorationGraph {
    return { ...this.graph };
  }

  // Get current node
  getCurrentNode(): DesignNode | null {
    if (!this.graph.currentNodeId) return null;
    return this.graph.nodes.find(n => n.id === this.graph.currentNodeId) || null;
  }

  // Add listener for graph changes
  addListener(callback: (graph: DesignExplorationGraph) => void) {
    this.listeners.push(callback);
  }

  // Remove listener
  removeListener(callback: (graph: DesignExplorationGraph) => void) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  // Notify all listeners
  private notifyListeners() {
    this.listeners.forEach(callback => callback(this.getGraph()));
  }
}

export const designExplorationService = new DesignExplorationService();
