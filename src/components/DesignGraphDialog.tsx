import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { X, RotateCcw, Zap, Loader2 } from 'lucide-react';
import { DesignExplorationGraph, DesignNode } from '../types/designExploration';
import { designExplorationService } from '../services/DesignExplorationService';

interface DesignGraphDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReinstateConfiguration: (nodeId: string) => void;
  onRunEnergySimulation?: (nodeId: string) => void;
  energySimAvailable?: boolean;
}

export const DesignGraphDialog: React.FC<DesignGraphDialogProps> = ({
  isOpen,
  onClose,
  onReinstateConfiguration,
  onRunEnergySimulation,
  energySimAvailable = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graph, setGraph] = useState<DesignExplorationGraph>(designExplorationService.getGraph());
  const [selectedNode, setSelectedNode] = useState<DesignNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    const handleGraphUpdate = (updatedGraph: DesignExplorationGraph) => {
      setGraph(updatedGraph);
    };

    designExplorationService.addListener(handleGraphUpdate);
    
    return () => {
      designExplorationService.removeListener(handleGraphUpdate);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !svgRef.current || graph.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 600;
    const height = 400;
    const nodeRadius = 8;

    // Transform edges to D3 link format
    const linkData = graph.edges.map(edge => ({
      source: edge.from,
      target: edge.to
    }));

    // Create force simulation
    const simulation = d3.forceSimulation(graph.nodes as any)
      .force("link", d3.forceLink(linkData).id((d: any) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(nodeRadius + 10));

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom as any);

    // Create container for zoomable content
    const container = svg.append("g");

    // Draw edges
    const linkElements = container.append("g")
      .selectAll("line")
      .data(linkData)
      .enter().append("line")
      .attr("stroke", "#64748b")
      .attr("stroke-width", 2)
      .attr("opacity", 0.6);

    // Draw nodes
    const nodeElements = container.append("g")
      .selectAll("g")
      .data(graph.nodes)
      .enter().append("g")
      .style("cursor", "pointer");

    // Node circles
    nodeElements.append("circle")
      .attr("r", nodeRadius)
      .attr("fill", (d: DesignNode) => {
        if (d.id === graph.currentNodeId) return "#10b981";
        if (d.id === hoveredNode) return "#3b82f6";
        return "#6366f1";
      })
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 2)
      .on("mouseover", (_event, d: DesignNode) => {
        setHoveredNode(d.id);
      })
      .on("mouseout", () => {
        setHoveredNode(null);
      })
      .on("click", (_event, d: DesignNode) => {
        setSelectedNode(d);
      });

    // Node labels
    nodeElements.append("text")
      .text((d: DesignNode) => d.name)
      .attr("dy", nodeRadius + 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#e5e7eb")
      .attr("font-size", "12px")
      .attr("font-weight", "500");

    // Current node indicator
    nodeElements
      .filter((d: DesignNode) => d.id === graph.currentNodeId)
      .append("circle")
      .attr("r", nodeRadius + 4)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4,2");

    // Update positions on simulation tick
    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeElements.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

  }, [isOpen, graph, hoveredNode]);

  const handleReinstateConfiguration = () => {
    if (selectedNode && selectedNode.id !== graph.currentNodeId) {
      onReinstateConfiguration(selectedNode.id);
      setSelectedNode(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <h2 className="text-xl font-semibold text-white">Design Exploration Graph</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex h-[28rem]">
          {/* Graph Canvas */}
          <div className="flex-1 relative">
            <svg
              ref={svgRef}
              width="600"
              height="400"
              className="w-full h-full bg-gray-950/50"
            />
            <div className="absolute top-4 left-4 text-xs text-gray-400">
              Use mouse wheel to zoom • Drag to pan • Click nodes to select
            </div>
          </div>

          {/* Node Details Panel */}
          <div className="w-[340px] shrink-0 border-l border-gray-700/50 bg-gray-900/50 min-w-0 flex flex-col">
            {selectedNode ? (
              <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white break-words leading-tight">{selectedNode.name}</h3>
                  <p className="text-sm text-gray-400">
                    {selectedNode.timestamp.toLocaleDateString()} at {selectedNode.timestamp.toLocaleTimeString()}
                  </p>
                  {selectedNode.id === graph.currentNodeId && (
                    <span className="inline-block mt-2 px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full">
                      Current Design
                    </span>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                  <h4 className="text-sm font-medium text-gray-300">Performance Metrics</h4>
                  
                  <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2 items-start">
                    <span className="text-sm text-gray-400">Embodied Carbon:</span>
                    <span className="text-sm text-orange-300 text-right break-words">
                      {selectedNode.metrics.globalWarmingPotential > 0
                        ? `${selectedNode.metrics.globalWarmingPotential.toFixed(1)} kg CO₂e/m²`
                        : <span className="text-gray-500 italic">not computed</span>
                      }
                    </span>

                    <span className="text-sm text-gray-400">Daylight Autonomy:</span>
                    <span className="text-sm text-white text-right break-words">
                      {selectedNode.metrics.spatialDaylightAutonomy > 0
                        ? `${selectedNode.metrics.spatialDaylightAutonomy}%`
                        : <span className="text-gray-500 italic">not run</span>
                      }
                    </span>

                    {selectedNode.metrics.heatingDemand !== undefined && (
                      <>
                        <span className="text-sm text-gray-400">Heating Demand:</span>
                        <span className="text-sm text-blue-300 text-right">
                          {selectedNode.metrics.heatingDemand.toFixed(1)} kWh/m²/yr
                        </span>
                      </>
                    )}
                    {selectedNode.metrics.coolingDemand !== undefined && (
                      <>
                        <span className="text-sm text-gray-400">Cooling Demand:</span>
                        <span className="text-sm text-blue-300 text-right">
                          {selectedNode.metrics.coolingDemand.toFixed(1)} kWh/m²/yr
                        </span>
                      </>
                    )}
                    {selectedNode.metrics.totalEnergy !== undefined && (
                      <>
                        <span className="text-sm text-gray-400">Total Energy:</span>
                        <span className="text-sm font-semibold text-blue-300 text-right">
                          {selectedNode.metrics.totalEnergy.toFixed(1)} kWh/m²/yr
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {selectedNode.daylightRun && (
                  <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                    <h4 className="text-sm font-medium text-gray-300">Daylight Run</h4>

                    <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-2 items-start">
                      <span className="text-sm text-gray-400">Status:</span>
                      <span className="text-sm text-white capitalize text-right break-words">{selectedNode.daylightRun.status}</span>

                      {selectedNode.daylightRun.studyId && (
                        <>
                          <span className="text-sm text-gray-400">Study ID:</span>
                          <span className="text-xs text-white text-right break-all">{selectedNode.daylightRun.studyId}</span>
                        </>
                      )}

                      {selectedNode.daylightRun.sensorCount !== undefined && (
                        <>
                          <span className="text-sm text-gray-400">Sensors:</span>
                          <span className="text-sm text-white text-right">{selectedNode.daylightRun.sensorCount}</span>
                        </>
                      )}

                      {selectedNode.daylightRun.meanDF !== undefined && (
                        <>
                          <span className="text-sm text-gray-400">Mean DF:</span>
                          <span className="text-sm text-white text-right">{selectedNode.daylightRun.meanDF.toFixed(2)}%</span>
                        </>
                      )}
                    </div>

                    {selectedNode.daylightRun.error && (
                      <div className="text-xs text-red-300 bg-red-900/30 border border-red-700/30 rounded p-2 break-words max-h-28 overflow-y-auto">
                        {selectedNode.daylightRun.error}
                      </div>
                    )}
                  </div>
                )}

                {/* Energy Simulation card */}
                <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-300">Energy Simulation</h4>
                    {(!selectedNode.energyRun || selectedNode.energyRun.status === 'idle' || selectedNode.energyRun.status === 'failed') && (
                      <button
                        onClick={() => onRunEnergySimulation?.(selectedNode.id)}
                        disabled={!energySimAvailable}
                        className="flex items-center space-x-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs rounded transition-colors"
                        title={energySimAvailable ? 'Run EnergyPlus via EPSM' : 'Energy simulation backend not yet available'}
                      >
                        <Zap className="w-3 h-3" />
                        <span>Run</span>
                      </button>
                    )}
                  </div>

                  {!selectedNode.energyRun || selectedNode.energyRun.status === 'idle' ? (
                    <p className="text-xs text-gray-500">
                      {energySimAvailable
                        ? 'Click Run to submit an EnergyPlus simulation via EPSM.'
                        : 'Energy simulation backend is not yet available.'}
                    </p>
                  ) : selectedNode.energyRun.status === 'queued' || selectedNode.energyRun.status === 'running' ? (
                    <div className="flex items-center space-x-2 text-sm text-blue-300">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="capitalize">{selectedNode.energyRun.stage ?? selectedNode.energyRun.status}…</span>
                    </div>
                  ) : selectedNode.energyRun.status === 'failed' ? (
                    <div className="text-xs text-red-300 bg-red-900/30 border border-red-700/30 rounded p-2">
                      {selectedNode.energyRun.error ?? 'Simulation failed'}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
                  <h4 className="text-sm font-medium text-gray-300">Snapshot</h4>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Buildings:</span>
                    <span className="text-white font-medium">{selectedNode.buildings.length}</span>
                  </div>
                </div>

                {selectedNode.id !== graph.currentNodeId && (
                  <button
                    onClick={handleReinstateConfiguration}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reinstate Configuration</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 mt-16 px-5">
                <div className="text-lg mb-2">Select a node</div>
                <p className="text-sm">Click on any node in the graph to view its details and metrics</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700/50 bg-gray-900/30">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>{graph.nodes.length} design configurations saved</span>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                <span>Saved</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
