import type { ProjectHighlight } from "@/lib/validation/schemas";

/** A project's measured results. Renders nothing until the owner has supplied real figures. */
export function ProjectHighlights({ highlights }: { highlights: ProjectHighlight[] }) {
  if (highlights.length === 0) return null;
  return (
    <dl className="case-highlights" data-testid="project-highlights">
      {highlights.map((highlight) => (
        <div key={highlight.label}>
          <dt>{highlight.label}</dt>
          <dd>{highlight.value}</dd>
        </div>
      ))}
    </dl>
  );
}
