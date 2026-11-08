import type { Architecture } from "@/lib/explorer/schema";

const CELL_W = 220;
const CELL_H = 124;
const NODE_W = 176;
const NODE_H = 66;

/** Splits a label over two lines, at the space nearest its middle. */
function lines(label: string): string[] {
  if (label.length <= 18) return [label];
  const middle = label.length / 2;
  const spaces = [...label.matchAll(/ /g)].map((m) => m.index);
  if (spaces.length === 0) return [label];
  const at = spaces.reduce((a, b) => (Math.abs(b - middle) < Math.abs(a - middle) ? b : a));
  return [label.slice(0, at), label.slice(at + 1)];
}

/**
 * A still drawing of a project's system view, from the same data as its architecture explorer, to
 * compare with the running application.
 */
export function ArchitectureSketch({
  architecture,
  name,
}: {
  architecture: Architecture;
  name: string;
}) {
  const { system, nodes } = architecture;
  const centre = (id: string) => {
    const [col, row] = system.at[id]!;
    return { x: (col + 0.5) * CELL_W, y: (row + 0.5) * CELL_H };
  };

  return (
    <svg
      role="img"
      aria-label={`System architecture of ${name}: ${nodes
        .filter((n) => n.id in system.at)
        .map((n) => n.label)
        .join(", ")}.`}
      viewBox={`0 0 ${system.cols * CELL_W} ${system.rows * CELL_H}`}
      className="arch-sketch"
      data-testid="architecture-sketch"
    >
      {system.edges.map(([from, to]) => {
        const a = centre(from);
        const b = centre(to);
        return (
          <line
            key={`${from}-${to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            className="arch-sketch-edge"
          />
        );
      })}
      {nodes
        .filter((node) => node.id in system.at)
        .map((node) => {
          const { x, y } = centre(node.id);
          const text = lines(node.label);
          return (
            <g key={node.id}>
              <rect
                x={x - NODE_W / 2}
                y={y - NODE_H / 2}
                width={NODE_W}
                height={NODE_H}
                className="arch-sketch-node"
              />
              {text.map((line, i) => (
                <text
                  key={line}
                  x={x}
                  y={y + 5 + (i - (text.length - 1) / 2) * 18}
                  textAnchor="middle"
                  className="arch-sketch-label"
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
    </svg>
  );
}
