"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useRef } from "react";
import { useElementSize } from "@/hooks/useElementSize";
import { boxConnector, edgeKey, type highlight } from "@/lib/explorer/graph";
import type { ArchitectureNode, ArchitectureView } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";

/** Node height in pixels; connectors are calculated from it, and CSS fixes nodes to the same. */
const NODE_H = 64;
const ROW_H = 118;
const MAX_NODE_W = 170;
/** Approximate width of one character of an edge label. */
const LABEL_CHAR_W = 6.4;

interface DiagramProps {
  /** Changes when the view changes, so the connectors draw themselves again. */
  viewKey: string;
  view: ArchitectureView;
  nodes: ArchitectureNode[];
  lit: ReturnType<typeof highlight>;
  selected: string | null;
  onSelect: (id: string) => void;
}

/**
 * The wide diagram: nodes are buttons positioned on the view's grid and connectors are drawn in a
 * measured SVG. A node shared by both views slides to its new position when the view changes.
 */
export function ArchitectureDiagram({
  viewKey,
  view,
  nodes,
  lit,
  selected,
  onSelect,
}: DiagramProps) {
  const canvas = useRef<HTMLDivElement>(null);
  const size = useElementSize(canvas);
  const reduced = useReducedMotion();
  const marker = useId();

  // A quarter of each column stays free, so connectors have room to curve and show their arrows.
  const nodeW = size ? Math.min(MAX_NODE_W, (size.width / view.cols) * 0.76) : MAX_NODE_W;
  const at = (id: string) => {
    const [col, row] = view.at[id]!;
    return { fx: (col + 0.5) / view.cols, fy: (row + 0.5) / view.rows };
  };

  return (
    <div
      ref={canvas}
      className="arch-canvas"
      style={{ height: view.rows * ROW_H, "--node-w": `${nodeW}px` } as React.CSSProperties}
      data-testid="arch-canvas"
    >
      {size && (
        <svg aria-hidden="true" width={size.width} height={size.height} className="arch-edges">
          <defs>
            {["rest", "lit"].map((tone) => (
              <marker
                key={tone}
                id={`${marker}-${tone}`}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0 0 L8 4 L0 8 z" className={`arch-arrow-${tone}`} />
              </marker>
            ))}
          </defs>
          {view.edges.map((edge, i) => {
            const a = at(edge[0]);
            const b = at(edge[1]);
            const { d, middle, labelRoom } = boxConnector(
              { x: a.fx * size.width, y: a.fy * size.height },
              { x: b.fx * size.width, y: b.fy * size.height },
              nodeW / 2,
              NODE_H / 2,
            );
            const key = edgeKey(edge);
            const on = lit.edges.has(key);
            return (
              <g key={`${viewKey}-${key}`} data-edge={key} data-lit={on || undefined}>
                <motion.path
                  d={d}
                  className="arch-edge"
                  data-dim={(lit.active && !on) || undefined}
                  markerEnd={`url(#${marker}-${on ? "lit" : "rest"})`}
                  initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.55, delay: i * 0.025, ease: EASE_OUT }}
                />
                {on && edge[2].length * LABEL_CHAR_W <= labelRoom && (
                  <text
                    x={middle.x}
                    y={middle.y - 7}
                    textAnchor="middle"
                    className="arch-edge-label"
                  >
                    {edge[2]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {nodes.map((node) => {
        const { fx, fy } = at(node.id);
        return (
          <button
            key={node.id}
            type="button"
            className="arch-node"
            style={{ left: `${fx * 100}%`, top: `${fy * 100}%` } as React.CSSProperties}
            aria-pressed={selected === node.id}
            data-kind={node.kind}
            data-dim={(lit.active && !lit.nodes.has(node.id)) || undefined}
            data-on={lit.nodes.has(node.id) || undefined}
            data-testid={`arch-node-${node.id}`}
            onClick={() => onSelect(node.id)}
          >
            <span className="arch-node-kind">{node.kind}</span>
            <span className="arch-node-label">{node.label}</span>
          </button>
        );
      })}
    </div>
  );
}
