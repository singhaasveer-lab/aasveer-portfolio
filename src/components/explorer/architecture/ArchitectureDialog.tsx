"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArchitectureDiagram } from "@/components/explorer/architecture/ArchitectureDiagram";
import { NodeDetail } from "@/components/explorer/architecture/NodeDetail";
import { useExplorer } from "@/components/explorer/ExplorerProvider";
import { Overlay } from "@/components/explorer/Overlay";
import { CloseIcon } from "@/components/ui/Icons";
import { useMedia } from "@/hooks/useSceneMotion";
import type { ProjectView } from "@/lib/data/loadPortfolio";
import { highlight } from "@/lib/explorer/graph";
import type { Architecture } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";

type Mode = "system" | "engineering";

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "system", label: "System view", note: "The main parts and how they connect." },
  { id: "engineering", label: "Engineering view", note: "Components, data flow and detail." },
];

function Explorer({
  architecture,
  project,
  onClose,
}: {
  architecture: Architecture;
  project: ProjectView;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<Mode>("system");
  const [selected, setSelected] = useState<string | null>(null);
  const [flow, setFlow] = useState<string | null>(null);
  const narrow = useMedia("(max-width: 899px)", false);

  const view = architecture[mode];
  const placed = (id: string) => view.at[id] !== undefined;
  // Reading order follows the data: left to right, then top to bottom.
  const nodes = architecture.nodes
    .filter((n) => placed(n.id))
    .sort((a, b) => {
      const [ac, ar] = view.at[a.id]!;
      const [bc, br] = view.at[b.id]!;
      return ac - bc || ar - br;
    });
  const node = selected && placed(selected) ? nodes.find((n) => n.id === selected)! : null;
  const flows = view.flows ?? [];
  const activeFlow = flows.find((f) => f.label === flow) ?? null;
  const lit = highlight(view.edges, { node: node?.id, flow: activeFlow?.path });

  function select(id: string) {
    setFlow(null);
    setSelected(id === selected ? null : id);
  }

  const detail = node && (
    <NodeDetail node={node} view={view} nodes={architecture.nodes} onSelect={select} />
  );
  const nameOf = (id: string) => architecture.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <>
      <header className="arch-head">
        <div className="min-w-0">
          <p className="label">Explore the architecture / {project.category}</p>
          <h2 id="architecture-title" className="display mt-2 text-[clamp(2rem,4vw,3.2rem)]">
            {project.display_name}
          </h2>
        </div>
        <button
          type="button"
          className="overlay-close"
          aria-label="Close architecture explorer"
          data-testid="architecture-close"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </header>

      <p className="max-w-[80ch] leading-relaxed text-muted">{architecture.summary}</p>

      <div className="arch-toolbar">
        <div className="arch-modes" role="group" aria-label="Diagram detail">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="arch-mode"
              aria-pressed={mode === item.id}
              title={item.note}
              data-testid={`arch-mode-${item.id}`}
              onClick={() => {
                setMode(item.id);
                setFlow(null);
              }}
            >
              {mode === item.id && (
                <motion.span
                  layoutId="arch-mode-mark"
                  className="arch-mode-mark"
                  aria-hidden="true"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                />
              )}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>
        {flows.length > 0 && (
          <div className="arch-flows" role="group" aria-label="Trace a data flow">
            <span className="label">Trace</span>
            {flows.map((item) => (
              <button
                key={item.label}
                type="button"
                className="lab-variant"
                aria-pressed={flow === item.label}
                data-testid="arch-flow"
                onClick={() => {
                  setSelected(null);
                  setFlow(flow === item.label ? null : item.label);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {narrow ? (
        <ol className="arch-flowlist" data-testid="arch-flowlist">
          {nodes.map((item) => {
            const next = view.edges.filter((e) => e[0] === item.id).map((e) => nameOf(e[1]));
            return (
              <li key={item.id} data-dim={(lit.active && !lit.nodes.has(item.id)) || undefined}>
                <button
                  type="button"
                  className="arch-node arch-node-row"
                  aria-pressed={selected === item.id}
                  data-kind={item.kind}
                  data-on={lit.nodes.has(item.id) || undefined}
                  data-testid={`arch-node-${item.id}`}
                  onClick={() => select(item.id)}
                >
                  <span className="arch-node-kind">{item.kind}</span>
                  <span className="arch-node-label">{item.label}</span>
                </button>
                {next.length > 0 && <p className="arch-next">Feeds {next.join(", ")}</p>}
                {selected === item.id && detail}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="arch-stage">
          <ArchitectureDiagram
            viewKey={`${architecture.slug}-${mode}`}
            view={view}
            nodes={nodes}
            lit={lit}
            selected={node?.id ?? null}
            onSelect={select}
          />
          <aside className="arch-aside" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={node?.id ?? "hint"}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                {detail ?? (
                  <div className="arch-detail">
                    <p className="label">Component detail</p>
                    <p className="mt-3 leading-relaxed text-muted">
                      Select any component to see its responsibility, inputs, outputs, technologies
                      and connections.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </aside>
        </div>
      )}
    </>
  );
}

/** The architecture overlay. Rendered once; any project card, skill or command can open it. */
export function ArchitectureDialog() {
  const { architecture, architectures, projects, closeArchitecture } = useExplorer();
  const current = architectures.find((a) => a.slug === architecture);
  const project = projects.find((p) => p.slug === architecture);

  return (
    <Overlay
      open={Boolean(current && project)}
      onClose={closeArchitecture}
      labelledBy="architecture-title"
      panelClassName="arch-panel"
      testId="architecture-dialog"
    >
      {current && project && (
        <Explorer
          key={current.slug}
          architecture={current}
          project={project}
          onClose={closeArchitecture}
        />
      )}
    </Overlay>
  );
}
