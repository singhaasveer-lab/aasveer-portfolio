import { ScrollReveal, type RevealPreset } from "@/components/motion/ScrollReveal";
import { ProjectCard, type ProjectLayout } from "@/components/projects/ProjectCard";
import type { ProjectView } from "@/lib/data/loadPortfolio";

export const PROJECTS_EMPTY_TEXT = "No project entries are available right now.";

/**
 * Asymmetric arrangement: the first project is featured full width, the middle ones share rows,
 * and when the middle fills its rows evenly the last returns full width with its visual on the
 * opposite side.
 */
function layoutFor(index: number, count: number): ProjectLayout {
  if (index === 0) return "featured";
  if (count >= 4 && index === count - 1 && (count - 2) % 2 === 0) return "wide";
  return "column";
}

/** Paired cards are unequal, and the wider one swaps sides from one row to the next. */
function spanFor(index: number, layout: ProjectLayout) {
  if (layout !== "column") return "lg:col-span-12";
  const row = Math.floor((index - 1) / 2);
  const first = (index - 1) % 2 === 0;
  return first === (row % 2 === 0) ? "lg:col-span-7" : "lg:col-span-5";
}

/**
 * Each card enters on its own scroll position: full-width cards stand up out of depth, and the
 * two cards in a shared row swing in from opposite sides.
 */
function entranceFor(index: number, layout: ProjectLayout): RevealPreset {
  if (layout !== "column") return "rise-3d";
  return (index - 1) % 2 === 0 ? "swing-left" : "swing-right";
}

/** Renders the projects it receives, in the order received. */
export function ProjectsSection({
  projects,
  preview = false,
}: {
  projects: ProjectView[];
  preview?: boolean;
}) {
  if (projects.length === 0) {
    return (
      <div className="relative overflow-hidden border border-line px-8 py-16 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_80%_at_50%_100%,rgb(98_210_191/0.08),transparent_70%)]"
        />
        <p className="relative text-muted" data-testid="projects-empty">
          {PROJECTS_EMPTY_TEXT}
        </p>
      </div>
    );
  }
  return (
    <ol className="grid items-stretch gap-5 lg:grid-cols-12 lg:gap-6">
      {projects.map((project, i) => {
        const layout = layoutFor(i, projects.length);
        return (
          <ScrollReveal
            as="li"
            key={project.slug}
            preset={entranceFor(i, layout)}
            className={`min-w-0 ${spanFor(i, layout)}`}
          >
            <ProjectCard
              project={project}
              position={i + 1}
              total={projects.length}
              layout={layout}
              preview={preview}
            />
          </ScrollReveal>
        );
      })}
    </ol>
  );
}
