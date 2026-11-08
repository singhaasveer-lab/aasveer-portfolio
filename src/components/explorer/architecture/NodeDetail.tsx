"use client";

import type { ArchitectureNode, ArchitectureView } from "@/lib/explorer/schema";

function Field({
  label,
  items,
  className,
}: {
  label: string;
  items: string[];
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="label">{label}</dt>
      <dd>
        <ul className="arch-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </dd>
    </div>
  );
}

/**
 * Everything about one component. "Communicates with" is derived from the diagram's edges, so
 * the panel and the picture cannot disagree.
 */
export function NodeDetail({
  node,
  view,
  nodes,
  onSelect,
}: {
  node: ArchitectureNode;
  view: ArchitectureView;
  nodes: ArchitectureNode[];
  onSelect: (id: string) => void;
}) {
  const nameOf = (id: string) => nodes.find((n) => n.id === id)?.label ?? id;
  const links = view.edges.flatMap(([from, to, label]) => {
    if (from === node.id) return [{ id: to, label, arrow: "→" }];
    if (to === node.id) return [{ id: from, label, arrow: "←" }];
    return [];
  });

  return (
    <div className="arch-detail" data-testid="arch-detail" data-node={node.id}>
      <p className="label">{node.kind}</p>
      <h3 className="display mt-2 text-[1.7rem]">{node.label}</h3>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <dt className="label">Responsibility</dt>
          <dd className="mt-1 leading-relaxed text-text">{node.responsibility}</dd>
        </div>
        <Field label="Inputs" items={node.inputs} />
        <Field label="Outputs" items={node.outputs} />
        <Field className="col-span-2" label="Technologies" items={node.technologies} />
        {links.length > 0 && (
          <div className="col-span-2">
            <dt className="label">Communicates with</dt>
            <dd>
              <ul className="arch-links">
                {links.map((link) => (
                  <li key={`${link.arrow}${link.id}${link.label}`}>
                    <button type="button" onClick={() => onSelect(link.id)}>
                      <span aria-hidden="true">{link.arrow}</span> {nameOf(link.id)}
                    </button>
                    <span className="text-faint">{link.label}</span>
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        )}
        <div className="col-span-2">
          <dt className="label">Source</dt>
          <dd className="mt-1 font-mono text-xs break-all text-muted">{node.source}</dd>
        </div>
      </dl>
    </div>
  );
}
