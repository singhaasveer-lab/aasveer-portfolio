"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { ArchitectureTrigger } from "@/components/explorer/architecture/ArchitectureTrigger";
import { useExplorer } from "@/components/explorer/ExplorerProvider";
import { useElementSize } from "@/hooks/useElementSize";
import { horizontalCurve } from "@/lib/explorer/graph";
import type { Capability } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";
import { goToElement } from "@/lib/navigation";

/** Capabilities and projects sit on two arcs facing each other, as fractions of the field. */
const arc = (i: number, count: number, side: -1 | 1, compact: boolean) => {
  const middle = Math.max((count - 1) / 2, 0.5);
  const bow = ((i - middle) / middle) ** 2 * (compact ? 0.02 : 0.05);
  // The labels on each side need different room, so the arcs sit off-centre with a long reach.
  if (compact) return { x: 0.5 + side * (0.105 + bow), y: (i + 0.5) / count };
  return { x: (side < 0 ? 0.36 : 0.72) + side * bow, y: (i + 0.5) / count };
};

/** Below this width the arcs move closer together, to leave room for their labels. */
const COMPACT_WIDTH = 620;

/** The id of the Laboratory's workflow block, which a capability can open. */
export const WORKFLOWS_ID = "lab-workflows";

type Focus = { kind: "capability" | "project"; id: string };

/**
 * The capability map: technical capabilities on one arc and the projects that really use them on
 * the other, joined only where the project's source confirms it. Selecting a capability or a
 * project fills the panel beside it; a capability with a Laboratory module opens that module's
 * workflow below. On phones the arcs close up and the panel moves under the network.
 */
export function CapabilityNetwork({
  capabilities,
  moduleNames,
}: {
  capabilities: Capability[];
  /** Laboratory module labels by id, for the "open its workflow" action. */
  moduleNames: Record<string, string>;
}) {
  const { projects, setLabModule } = useExplorer();
  const [selected, setSelected] = useState<Focus>({
    kind: "capability",
    id: capabilities[0]!.id,
  });
  const [hovered, setHovered] = useState<Focus | null>(null);
  const field = useRef<HTMLDivElement>(null);
  /** Where the pointer last really was. Content moving under a still pointer is not a hover. */
  const pointer = useRef({ x: NaN, y: NaN });
  const size = useElementSize(field);
  const compact = !!size && size.width < COMPACT_WIDTH;
  const reduced = useReducedMotion();

  const shown = projects.filter((p) =>
    capabilities.some((c) => c.projects.some((x) => x.slug === p.slug)),
  );
  const focus = hovered ?? selected;
  const isLit = (capability: string, slug: string) =>
    focus.kind === "capability" ? capability === focus.id : slug === focus.id;
  const litCapabilities = new Set(
    capabilities.filter((c) => c.projects.some((p) => isLit(c.id, p.slug))).map((c) => c.id),
  );
  const litProjects = new Set(
    capabilities.flatMap((c) => c.projects.filter((p) => isLit(c.id, p.slug)).map((p) => p.slug)),
  );
  const same = (a: Focus, kind: Focus["kind"], id: string) => a.kind === kind && a.id === id;

  const at = (point: { x: number; y: number }) => ({
    x: point.x * (size?.width ?? 0),
    y: point.y * (size?.height ?? 0),
  });
  const nameOf = (slug: string) => projects.find((p) => p.slug === slug)?.display_name ?? slug;

  const select = (next: Focus) => {
    setHovered(null);
    setSelected(next);
  };
  const preview = (next: Focus) => (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    // A taller panel can move the pinned network under a still pointer, and the browser reports
    // that as entering another node. Only real pointer movement previews.
    const { x, y } = pointer.current;
    if (event.clientX === x && event.clientY === y) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    setHovered(next);
  };

  const openWorkflow = (module: string) => {
    setLabModule(module);
    const target = document.getElementById(WORKFLOWS_ID);
    if (target) goToElement(WORKFLOWS_ID, target);
  };

  const capability =
    selected.kind === "capability" ? capabilities.find((c) => c.id === selected.id) : undefined;
  const project =
    selected.kind === "project" ? shown.find((p) => p.slug === selected.id) : undefined;

  return (
    <div className="explore" data-testid="capability-network">
      <div
        ref={field}
        className="explore-field"
        style={{ "--rows": capabilities.length } as React.CSSProperties}
        onPointerLeave={() => setHovered(null)}
        onPointerMove={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY };
        }}
      >
        {size && (
          <svg aria-hidden="true" width={size.width} height={size.height} className="explore-lines">
            {capabilities.flatMap((c, ci) =>
              c.projects.map(({ slug }) => {
                const pi = shown.findIndex((p) => p.slug === slug);
                if (pi < 0) return null;
                const d = horizontalCurve(
                  at(arc(ci, capabilities.length, -1, compact)),
                  at(arc(pi, shown.length, 1, compact)),
                );
                const on = isLit(c.id, slug);
                const key = `${focus.kind}-${focus.id}`;
                return (
                  <g key={`${c.id}:${slug}`}>
                    <path
                      d={d}
                      className="explore-line"
                      data-link={`${c.id}:${slug}`}
                      data-on={on || undefined}
                    />
                    {on && (
                      <motion.path
                        key={key}
                        d={d}
                        className="explore-line-lit"
                        initial={reduced ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.55, ease: EASE_OUT }}
                      />
                    )}
                    {on && !reduced && (
                      <circle
                        key={`pulse-${key}`}
                        r="3"
                        className="matrix-pulse"
                        data-testid="network-pulse"
                        style={{ offsetPath: `path("${d}")` }}
                      />
                    )}
                  </g>
                );
              }),
            )}
          </svg>
        )}

        <ul className="explore-topics" aria-label="Capabilities">
          {capabilities.map((c, i) => {
            const point = arc(i, capabilities.length, -1, compact);
            return (
              <li
                key={c.id}
                style={
                  {
                    "--edge": `${(1 - point.x) * 100}%`,
                    "--y": `${point.y * 100}%`,
                  } as React.CSSProperties
                }
              >
                <button
                  type="button"
                  className="explore-topic"
                  aria-pressed={same(selected, "capability", c.id)}
                  data-focus={litCapabilities.has(c.id) || undefined}
                  data-testid={`network-capability-${c.id}`}
                  onClick={() => select({ kind: "capability", id: c.id })}
                  onPointerEnter={preview({ kind: "capability", id: c.id })}
                >
                  <span className="explore-topic-label">{c.label}</span>
                  <span className="explore-dot" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>

        <ul className="explore-projects" aria-label="Projects">
          {shown.map((p, i) => {
            const point = arc(i, shown.length, 1, compact);
            return (
              <li
                key={p.slug}
                data-on={litProjects.has(p.slug) || undefined}
                style={
                  { "--x": `${point.x * 100}%`, "--y": `${point.y * 100}%` } as React.CSSProperties
                }
              >
                <button
                  type="button"
                  className="explore-project"
                  aria-pressed={same(selected, "project", p.slug)}
                  data-testid={`network-project-${p.slug}`}
                  onClick={() => select({ kind: "project", id: p.slug })}
                  onPointerEnter={preview({ kind: "project", id: p.slug })}
                >
                  <span className="explore-dot" aria-hidden="true" />
                  {p.display_name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="explore-reading" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${selected.kind}-${selected.id}`}
            data-testid="network-panel"
            data-kind={selected.kind}
            data-id={selected.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
          >
            {capability && (
              <>
                <p className="explore-kind">Capability</p>
                <h4 className="ab-reading-title">{capability.label}</h4>
                <p className="ab-reading-text">{capability.description}</p>
                <p className="explore-kind mt-6">
                  Connected projects <span aria-hidden="true">·</span> {capability.projects.length}
                </p>
                <ul className="explore-uses">
                  {capability.projects.map((use, i) => (
                    <li key={use.slug} style={{ "--i": i } as React.CSSProperties}>
                      <p className="explore-use-name">{nameOf(use.slug)}</p>
                      <p className="explore-use-note">{use.note}</p>
                      <ArchitectureTrigger
                        slug={use.slug}
                        name={nameOf(use.slug)}
                        className="matrix-action"
                      />
                    </li>
                  ))}
                </ul>
                {capability.lab && moduleNames[capability.lab] && (
                  <button
                    type="button"
                    className="explore-next"
                    data-testid="network-workflow"
                    onClick={() => openWorkflow(capability.lab!)}
                  >
                    Open the {moduleNames[capability.lab]} workflow{" "}
                    <span aria-hidden="true">↓</span>
                  </button>
                )}
              </>
            )}
            {project && (
              <>
                <p className="explore-kind">Project · {project.category}</p>
                <h4 className="ab-reading-title">{project.display_name}</h4>
                <p className="ab-reading-text">{project.problem_statement}</p>
                <p className="explore-kind mt-6">
                  Capabilities it uses <span aria-hidden="true">·</span>{" "}
                  {litProjectsCount(capabilities, project.slug)}
                </p>
                <ul className="explore-uses">
                  {capabilities
                    .filter((c) => c.projects.some((p) => p.slug === project.slug))
                    .map((c, i) => (
                      <li key={c.id} style={{ "--i": i } as React.CSSProperties}>
                        <p className="explore-use-name">{c.label}</p>
                        <p className="explore-use-note">
                          {c.projects.find((p) => p.slug === project.slug)!.note}
                        </p>
                      </li>
                    ))}
                </ul>
                <div className="mt-4">
                  <ArchitectureTrigger
                    slug={project.slug}
                    name={project.display_name}
                    className="matrix-action explore-arch"
                  />
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <noscript>
        <dl className="ab-noscript">
          {capabilities.map((c) => (
            <div key={c.id}>
              <dt>{c.label}</dt>
              <dd>
                {c.description} Used in:{" "}
                {c.projects.map((p) => `${nameOf(p.slug)} (${p.note})`).join("; ")}.
              </dd>
            </div>
          ))}
        </dl>
      </noscript>
    </div>
  );
}

function litProjectsCount(capabilities: Capability[], slug: string) {
  return capabilities.filter((c) => c.projects.some((p) => p.slug === slug)).length;
}
