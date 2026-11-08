"use client";

import { motion } from "motion/react";
import type { LabModule, LabStage, StageNote } from "@/lib/explorer/schema";
import { DURATION, EASE_OUT } from "@/lib/motion";

function Weights({
  weights,
  source,
}: {
  weights: NonNullable<StageNote["weights"]>;
  source: string;
}) {
  const largest = Math.max(...weights.map((w) => w.value));
  return (
    <div className="lab-weights">
      <p className="label">Fixed weights in {source}</p>
      <ul>
        {weights.map((weight, i) => (
          <li key={weight.label}>
            <span>{weight.label}</span>
            <span className="lab-weight-bar" aria-hidden="true">
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: weight.value / largest }}
                transition={{ duration: DURATION.base, delay: i * 0.04, ease: EASE_OUT }}
              />
            </span>
            <span className="font-mono">{weight.value.toFixed(2)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What one stage does: the idea, how this project implements it, and the code behind it. */
export function StagePanel({
  stage,
  note,
  module,
  projectName,
  position,
}: {
  stage: LabStage;
  note: StageNote;
  module: LabModule;
  projectName: string;
  position: string;
}) {
  const layer = module.layers.find((l) => l.id === stage.layer)!;
  const skipped = note.status === "not_used";

  return (
    <div className="lab-panel" data-testid="lab-stage-panel" data-stage={stage.id}>
      <div className="min-w-0">
        <p className="label">
          Stage {position} / <span data-layer={stage.layer}>{layer.label}</span>
        </p>
        <h3 className="display mt-3 text-[clamp(1.7rem,3vw,2.4rem)]">{stage.label}</h3>
        <p className="mt-4 leading-relaxed text-muted">{stage.concept}</p>
        <div className="lab-note" data-skipped={skipped || undefined}>
          <p className="label">{skipped ? `Not used in ${projectName}` : `In ${projectName}`}</p>
          <p className="mt-2 leading-relaxed text-text">{note.summary}</p>
        </div>
      </div>

      <div className="min-w-0">
        {!skipped && (
          <dl className="lab-io">
            <div>
              <dt className="label">Input</dt>
              <dd>{note.input}</dd>
            </div>
            <div>
              <dt className="label">Output</dt>
              <dd>{note.output}</dd>
            </div>
          </dl>
        )}
        {note.weights && (
          <Weights weights={note.weights} source={note.code?.source ?? "the ranking source"} />
        )}
        {note.code && (
          <details className="disclosure lab-code" open>
            <summary>
              <span className="font-mono text-xs">{note.code.source}</span>
              <span className="disclosure-marker" aria-hidden="true" />
            </summary>
            <pre>
              <code>{note.code.text}</code>
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
