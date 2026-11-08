"use client";

import { useOptionalExplorer } from "@/components/explorer/ExplorerProvider";
import { ShimmerLabel } from "@/components/motion/Accents";

/** Opens a project's architecture explorer; renders nothing where none is available. */
export function ArchitectureTrigger({
  slug,
  name,
  className = "btn btn-outline btn-caps",
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const explorer = useOptionalExplorer();
  if (!explorer?.architectures.some((a) => a.slug === slug)) return null;
  return (
    <button
      type="button"
      className={className}
      aria-label={`Explore architecture of ${name}`}
      data-testid="explore-architecture"
      onClick={() => explorer.openArchitecture(slug)}
    >
      <ShimmerLabel>Explore architecture</ShimmerLabel>
      <span className="btn-arrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}
