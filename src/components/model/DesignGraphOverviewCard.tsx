import React, { useEffect, useMemo, useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { designExplorationService } from '../../services/DesignExplorationService';
import { DesignExplorationGraph } from '../../types/designExploration';

interface DesignGraphOverviewCardProps {
  onOpenGraph: () => void;
}

const OVERVIEW_WIDTH = 168;
const OVERVIEW_HEIGHT = 112;
const OVERVIEW_PADDING = 10;

export const DesignGraphOverviewCard: React.FC<DesignGraphOverviewCardProps> = ({ onOpenGraph }) => {
  const [graph, setGraph] = useState<DesignExplorationGraph>(designExplorationService.getGraph());

  useEffect(() => {
    const handleGraphUpdate = (updatedGraph: DesignExplorationGraph) => {
      setGraph(updatedGraph);
    };

    designExplorationService.addListener(handleGraphUpdate);
    return () => {
      designExplorationService.removeListener(handleGraphUpdate);
    };
  }, []);

  const geometry = useMemo(() => {
    if (graph.nodes.length === 0) {
      return {
        projectedNodes: [],
        projectedEdges: [],
      };
    }

    const fallbackRadius = 110;
    const fallbackNodes = graph.nodes.map((node, index) => {
      const theta = (index / Math.max(1, graph.nodes.length)) * Math.PI * 2;
      const fallbackX = Math.cos(theta) * fallbackRadius;
      const fallbackY = Math.sin(theta) * fallbackRadius;
      return {
        ...node,
        x: node.position?.x ?? fallbackX,
        y: node.position?.y ?? fallbackY,
      };
    });

    const minX = Math.min(...fallbackNodes.map((node) => node.x));
    const maxX = Math.max(...fallbackNodes.map((node) => node.x));
    const minY = Math.min(...fallbackNodes.map((node) => node.y));
    const maxY = Math.max(...fallbackNodes.map((node) => node.y));

    const worldWidth = Math.max(1, maxX - minX);
    const worldHeight = Math.max(1, maxY - minY);
    const scale = Math.min(
      (OVERVIEW_WIDTH - OVERVIEW_PADDING * 2) / worldWidth,
      (OVERVIEW_HEIGHT - OVERVIEW_PADDING * 2) / worldHeight,
    );

    const offsetX = (OVERVIEW_WIDTH - worldWidth * scale) / 2;
    const offsetY = (OVERVIEW_HEIGHT - worldHeight * scale) / 2;

    const projectedNodes = fallbackNodes.map((node) => ({
      id: node.id,
      isCurrent: node.id === graph.currentNodeId,
      x: offsetX + (node.x - minX) * scale,
      y: offsetY + (node.y - minY) * scale,
    }));

    const nodeById = new Map(projectedNodes.map((node) => [node.id, node]));
    const projectedEdges = graph.edges
      .map((edge) => ({
        from: nodeById.get(edge.from),
        to: nodeById.get(edge.to),
      }))
      .filter((edge): edge is { from: { x: number; y: number }; to: { x: number; y: number } } => Boolean(edge.from && edge.to));

    return {
      projectedNodes,
      projectedEdges,
    };
  }, [graph]);

  return (
    <aside className="model-graph-overview absolute z-40 w-[204px] rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Graph Overview</div>
          <div className="text-[10px] text-slate-500">{graph.nodes.length} designs</div>
        </div>
        <button
          type="button"
          onClick={onOpenGraph}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 px-2 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          aria-label="Open design exploration graph"
          title="Open design graph"
        >
          <Maximize2 className="h-3 w-3" />
          Open
        </button>
      </div>

      <svg
        width={OVERVIEW_WIDTH}
        height={OVERVIEW_HEIGHT}
        className="block w-full rounded border border-slate-200 bg-slate-50"
        aria-label="Design graph overview"
      >
        <g>
          {geometry.projectedEdges.map((edge, index) => (
            <line
              key={`edge-${index}`}
              x1={edge.from.x}
              y1={edge.from.y}
              x2={edge.to.x}
              y2={edge.to.y}
              stroke="#94a3b8"
              strokeWidth={1}
            />
          ))}
        </g>
        <g>
          {geometry.projectedNodes.map((node) => (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={node.isCurrent ? 4.5 : 3.5}
              fill={node.isCurrent ? '#10b981' : '#64748b'}
              stroke="#ffffff"
              strokeWidth={1}
            />
          ))}
        </g>
      </svg>
    </aside>
  );
};
