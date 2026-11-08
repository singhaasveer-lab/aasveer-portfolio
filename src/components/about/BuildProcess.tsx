"use client";

import { useState } from "react";
import { ArchitectureTrigger } from "@/components/explorer/architecture/ArchitectureTrigger";
import { useExplorer } from "@/components/explorer/ExplorerProvider";
import { TransitionPanel } from "@/components/motion-primitives/transition-panel";
import type { About } from "@/lib/explorer/schema";
import { EASE_OUT } from "@/lib/motion";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * How I build: one signal path through five stages, across the page on desktop and down it on
 * phones, filled as far as the selected stage. Each explains the idea and points to one real
 * example, and the note says this is a general approach and not what every project followed.
 */
export function BuildProcess({ process }: { process: About["process"] }) {
  const { projects } = useExplorer();
  const [index, setIndex] = useState(0);
  const steps = process.stages.length;

  return (
    <div data-testid="build-process">
      <p className="ab-lede">{process.note}</p>
      <div
        className="journey"
        style={{ "--steps": steps, "--p": index / (steps - 1) } as React.CSSProperties}
      >
        <span className="journey-rail" aria-hidden="true">
          <span />
        </span>
        <ol className="journey-stages">
          {process.stages.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                className="journey-stage"
                aria-current={i === index ? "step" : undefined}
                data-reached={i <= index || undefined}
                data-testid={`process-${item.id}`}
                onClick={() => setIndex(i)}
              >
                <span className="journey-dot" aria-hidden="true" />
                <span className="journey-index" aria-hidden="true">
                  {pad(i + 1)}
                </span>
                <span className="journey-label">{item.label}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="journey-reading" aria-live="polite">
        <TransitionPanel
          activeIndex={index}
          mode="wait"
          transition={{ duration: 0.22, ease: EASE_OUT }}
          variants={{
            enter: { opacity: 0, x: 16 },
            center: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -10 },
          }}
        >
          {process.stages.map((stage, i) => {
            const project = projects.find((p) => p.slug === stage.example.project);
            return (
              <div
                key={stage.id}
                className="journey-panel"
                data-testid="process-panel"
                data-stage={stage.id}
              >
                <p className="journey-big" aria-hidden="true">
                  {pad(i + 1)}
                </p>
                <div className="min-w-0">
                  <h4 className="ab-reading-title">{stage.label}</h4>
                  <p className="ab-reading-text">{stage.explanation}</p>
                </div>
                {project && (
                  <div className="journey-example">
                    <p className="label">Seen in {project.display_name}</p>
                    <p className="mt-2 text-sm leading-relaxed text-text">{stage.example.text}</p>
                    <ArchitectureTrigger
                      slug={project.slug}
                      name={project.display_name}
                      className="matrix-action"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </TransitionPanel>
      </div>
      <noscript>
        <dl className="ab-noscript">
          {process.stages.map((stage) => (
            <div key={stage.id}>
              <dt>{stage.label}</dt>
              <dd>{stage.explanation}</dd>
            </div>
          ))}
        </dl>
      </noscript>
    </div>
  );
}
