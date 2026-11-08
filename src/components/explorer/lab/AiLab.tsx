"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useExplorer } from "@/components/explorer/ExplorerProvider";
import { ShimmerLabel, SoftGlow } from "@/components/motion/Accents";
import { TransitionPanel } from "@/components/motion-primitives/transition-panel";
import { LabTrack } from "@/components/explorer/lab/LabTrack";
import { QueueSimulator } from "@/components/explorer/lab/QueueSimulator";
import { StagePanel } from "@/components/explorer/lab/StagePanel";
import type { LabModule } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";

const TRACE_STEP_MS = 1300;

const pad = (n: number) => String(n).padStart(2, "0");

function ModulePanel({ module }: { module: LabModule }) {
  const { projects } = useExplorer();
  const variants = [...new Set(module.stages.flatMap((s) => s.notes.map((n) => n.project)))];
  const nameOf = (slug: string) => projects.find((p) => p.slug === slug)?.display_name ?? slug;

  const [project, setProject] = useState(variants[0]!);
  const [index, setIndex] = useState(0);
  const [tracing, setTracing] = useState(false);

  const stage = module.stages[index]!;
  const last = module.stages.length - 1;

  // A trace is started by the visitor, advances one stage at a time and stops at the last one.
  useEffect(() => {
    if (!tracing) return;
    const timer = setTimeout(() => {
      if (index >= last) setTracing(false);
      else setIndex(index + 1);
    }, TRACE_STEP_MS);
    return () => clearTimeout(timer);
  }, [tracing, index, last]);

  return (
    <>
      <p className="max-w-[68ch] leading-relaxed text-muted">{module.intro}</p>

      <div className="lab-controls">
        <div className="lab-variants" role="group" aria-label="Compare implementations">
          {variants.map((slug) => (
            <button
              key={slug}
              type="button"
              className="lab-variant"
              aria-pressed={slug === project}
              data-testid={`lab-variant-${slug}`}
              onClick={() => setProject(slug)}
            >
              {nameOf(slug)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="lab-trace"
          aria-pressed={tracing}
          data-testid="lab-trace"
          onClick={() => {
            if (!tracing) setIndex(0);
            setTracing(!tracing);
          }}
        >
          <span aria-hidden="true">{tracing ? "■" : "▶"}</span>
          {tracing ? "Stop trace" : <ShimmerLabel>Trace the signal</ShimmerLabel>}
        </button>
      </div>

      <LabTrack
        stages={module.stages}
        project={project}
        active={index}
        tracing={tracing}
        stepSeconds={(TRACE_STEP_MS - 100) / 1000}
        onSelect={(i) => {
          setTracing(false);
          setIndex(i);
        }}
      />

      <ul className="lab-legend">
        {module.layers.map((layer) => (
          <li key={layer.id} data-layer={layer.id} data-on={layer.id === stage.layer || undefined}>
            <span className="lab-legend-mark" aria-hidden="true" />
            <span>
              <strong>{layer.label}:</strong> {layer.description}
            </span>
          </li>
        ))}
      </ul>

      <TransitionPanel
        activeIndex={index}
        mode="wait"
        transition={{ duration: 0.2, ease: EASE_OUT }}
        variants={{
          enter: { opacity: 0, y: 10 },
          center: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -6 },
        }}
      >
        {module.stages.map((item, i) => (
          <StagePanel
            key={item.id}
            stage={item}
            note={item.notes.find((n) => n.project === project)!}
            module={module}
            projectName={nameOf(project)}
            position={`${pad(i + 1)} of ${pad(module.stages.length)}`}
          />
        ))}
      </TransitionPanel>

      {module.simulator === "queue" && <QueueSimulator />}
    </>
  );
}

/**
 * The AI Systems Laboratory: a module rack (tabs) beside the selected system's workflow. The
 * rack follows the shared explorer state, so the command centre and skill map can open a module.
 */
export function AiLab({ modules }: { modules: LabModule[] }) {
  const { labModule, setLabModule } = useExplorer();
  const current = modules.find((m) => m.id === labModule) ?? modules[0]!;
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(event: React.KeyboardEvent, i: number) {
    const count = modules.length;
    const next = {
      ArrowDown: (i + 1) % count,
      ArrowRight: (i + 1) % count,
      ArrowUp: (i - 1 + count) % count,
      ArrowLeft: (i - 1 + count) % count,
      Home: 0,
      End: count - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setLabModule(modules[next]!.id);
    tabs.current[next]?.focus();
  }

  return (
    <div className="lab" data-testid="ai-lab">
      <div className="lab-rack" role="tablist" aria-label="System modules">
        {modules.map((module, i) => {
          const selected = module.id === current.id;
          return (
            <button
              key={module.id}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`lab-tab-${module.id}`}
              aria-selected={selected}
              aria-controls="lab-panel"
              tabIndex={selected ? 0 : -1}
              className="lab-tab"
              data-testid={`lab-tab-${module.id}`}
              onClick={() => setLabModule(module.id)}
              onKeyDown={(event) => onKeyDown(event, i)}
            >
              <span className="lab-tab-index" aria-hidden="true">
                {pad(i + 1)}
              </span>
              {selected && (
                <SoftGlow
                  className="lab-tab-glow"
                  colors={[
                    `var(--hue-${module.stages[0]!.notes[0]!.project}, var(--accent))`,
                    "var(--blue)",
                  ]}
                />
              )}
              <span className="lab-tab-name">{module.short}</span>
              {selected && (
                <motion.span
                  layoutId="lab-tab-mark"
                  className="lab-tab-mark"
                  aria-hidden="true"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        id="lab-panel"
        role="tabpanel"
        aria-labelledby={`lab-tab-${current.id}`}
        className="lab-bench"
        data-testid="lab-panel"
        data-module={current.id}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.24, ease: EASE_OUT }}
          >
            <h3 className="label text-accent">{current.label}</h3>
            <div className="mt-4">
              <ModulePanel module={current} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
