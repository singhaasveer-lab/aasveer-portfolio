/** Geometry and connectivity shared by the Laboratory, architecture and skill-map diagrams. */

export interface Point {
  x: number;
  y: number;
}

/** A left-to-right S-curve that leaves and arrives horizontally. */
export function horizontalCurve(from: Point, to: Point): string {
  const bend = (to.x - from.x) / 2;
  return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`;
}

function verticalCurve(from: Point, to: Point): string {
  const bend = (to.y - from.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + bend}, ${to.x} ${to.y - bend}, ${to.x} ${to.y}`;
}

/**
 * The connector between two equally sized boxes given by their centres. Boxes in different
 * columns join side to side; boxes stacked in one column join top to bottom.
 */
export function boxConnector(a: Point, b: Point, halfW: number, halfH: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const stacked = Math.abs(dx) < halfW;
  const side = Math.sign(stacked ? dy : dx) || 1;
  const from = stacked ? { x: a.x, y: a.y + side * halfH } : { x: a.x + side * halfW, y: a.y };
  const to = stacked ? { x: b.x, y: b.y - side * halfH } : { x: b.x - side * halfW, y: b.y };
  return {
    d: stacked ? verticalCurve(from, to) : horizontalCurve(from, to),
    middle: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    /** Room for a label: boxes side by side in one row leave only the gap between them. */
    labelRoom: !stacked && Math.abs(dy) < halfH ? Math.abs(to.x - from.x) : Infinity,
  };
}

export type Edge = readonly [from: string, to: string, label: string];

export const edgeKey = (edge: Edge) => `${edge[0]}>${edge[1]}`;

/** What should stand out: the edges and nodes touching a node, or those along a flow. */
export function highlight(
  edges: readonly Edge[],
  focus: { node?: string | null; flow?: readonly string[] | null },
) {
  const lit = new Set<string>();
  const nodes = new Set<string>();
  if (focus.flow) {
    focus.flow.forEach((node, i) => {
      nodes.add(node);
      if (i > 0) lit.add(`${focus.flow![i - 1]}>${node}`);
    });
  } else if (focus.node) {
    nodes.add(focus.node);
    for (const edge of edges) {
      if (edge[0] !== focus.node && edge[1] !== focus.node) continue;
      lit.add(edgeKey(edge));
      nodes.add(edge[0]);
      nodes.add(edge[1]);
    }
  }
  return { edges: lit, nodes, active: nodes.size > 0 };
}
