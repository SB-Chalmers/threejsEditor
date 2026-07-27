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

    // Card dimensions
    const CW = 148; // card width
    const CH = 86;  // card height (name row + 3 stacked metric rows)
    const CHW = CW / 2;
    const CHH = CH / 2;
    // Collision radius ≈ half-diagonal + padding
    const collisionR = Math.sqrt(CHW * CHW + CHH * CHH) + 12;

    const fmt = (v: number | undefined, digits = 0) =>
      v != null ? v.toFixed(digits) : '—';

    // Transform edges to D3 link format
    const linkData = graph.edges.map(edge => ({
      source: edge.from,
      target: edge.to
    }));

    // Create force simulation
    const simulation = d3.forceSimulation(graph.nodes as any)
      .force("link", d3.forceLink(linkData).id((d: any) => d.id).distance(200))
      .force("charge", d3.forceManyBody().strength(-500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(collisionR));

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
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
      .attr("stroke", "#334155")
      .attr("stroke-width", 1.5)
      .attr("opacity", 0.7);

    // Draw nodes
    const nodeElements = container.append("g")
      .selectAll("g")
      .data(graph.nodes)
      .enter().append("g")
      .style("cursor", "pointer")
      .on("click", (_event, d: DesignNode) => setSelectedNode(d))
      .on("mouseover", (_event, d: DesignNode) => setHoveredNode(d.id))
      .on("mouseout", () => setHoveredNode(null));

    // Card background rect (re-selectable stroke for selected/current state)
    nodeElements.append("rect")
      .attr("x", -CHW)
      .attr("y", -CHH)
      .attr("width", CW)
      .attr("height", CH)
      .attr("rx", 8)
      .attr("fill", (d: DesignNode) =>
        d.id === graph.currentNodeId ? "#0c2a1e" : "#0f172a")
      .attr("stroke", (d: DesignNode) =>
        d.id === selectedNode?.id ? "#60a5fa"
        : d.id === graph.currentNodeId ? "#10b981"
        : "#334155")
      .attr("stroke-width", (d: DesignNode) =>
        d.id === selectedNode?.id || d.id === graph.currentNodeId ? 2 : 1);

    // Name row
    nodeElements.append("text")
      .text((d: DesignNode) => d.name.length > 18 ? d.name.slice(0, 17) + '…' : d.name)
      .attr("x", 0)
      .attr("y", -CHH + 16)
      .attr("text-anchor", "middle")
      .attr("fill", (d: DesignNode) => d.id === graph.currentNodeId ? "#6ee7b7" : "#f1f5f9")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .style("pointer-events", "none");

    // Separator line
    nodeElements.append("line")
      .attr("x1", -CHW + 8).attr("x2", CHW - 8)
      .attr("y1", -CHH + 22).attr("y2", -CHH + 22)
      .attr("stroke", "#1e293b").attr("stroke-width", 1);

    // Metric badges via foreignObject
    nodeElements.each(function(d: DesignNode) {
      const g = d3.select(this);
      const fo = g.append("foreignObject")
        .attr("x", -CHW + 4)
        .attr("y", -CHH + 26)
        .attr("width", CW - 8)
        .attr("height", CH - 30);

      const sda   = d.metrics.spatialDaylightAutonomy;
      const enrg  = d.metrics.totalEnergy;
      const gwp   = d.metrics.globalWarmingPotential;

      const sdaStr  = sda  > 0 ? `${sda}%`              : '—';
      const enrgStr = enrg != null ? `${fmt(enrg)} kWh`  : '—';
      const gwpStr  = gwp  > 0 ? `${fmt(gwp)} kg/m²`     : '—';

      fo.append("xhtml:div")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "3px")
        .style("height", "100%")
        .html(`
          <span style="display:flex;align-items:center;gap:4px;background:#172554;color:#93c5fd;font-size:9px;font-family:ui-sans-serif,system-ui,sans-serif;border-radius:4px;padding:2px 5px;white-space:nowrap">
            <span style="opacity:0.7">☀ sDA</span><span style="margin-left:auto;font-weight:600">${sdaStr}</span>
          </span>
          <span style="display:flex;align-items:center;gap:4px;background:#052e16;color:#86efac;font-size:9px;font-family:ui-sans-serif,system-ui,sans-serif;border-radius:4px;padding:2px 5px;white-space:nowrap">
            <span style="opacity:0.7">⚡ Energy</span><span style="margin-left:auto;font-weight:600">${enrgStr}</span>
          </span>
          <span style="display:flex;align-items:center;gap:4px;background:#2d1b0a;color:#fdba74;font-size:9px;font-family:ui-sans-serif,system-ui,sans-serif;border-radius:4px;padding:2px 5px;white-space:nowrap">
            <span style="opacity:0.7">🌿 GWP</span><span style="margin-left:auto;font-weight:600">${gwpStr}</span>
          </span>
        `);
    });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      linkElements
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeElements.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

  }, [isOpen, graph, hoveredNode, selectedNode]);

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
                <div className="w-4 h-3 bg-emerald-900 border border-emerald-500 rounded"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-3 bg-slate-900 border border-slate-600 rounded"></div>
                <span>Saved</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-3 bg-slate-900 border border-blue-400 rounded"></div>
                <span>Selected</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
