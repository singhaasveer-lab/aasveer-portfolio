import { SoftGlow, Stagger } from "@/components/motion/Accents";
import {
  MorphingDialog,
  MorphingDialogCard,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogTitle,
  MorphingDialogTrigger,
} from "@/components/motion-primitives/morphing-dialog";
import { ProjectCaseStudy } from "@/components/projects/ProjectCaseStudy";
import { ProjectSpotlight } from "@/components/projects/ProjectSpotlight";
import { ProjectThumb } from "@/components/projects/ProjectThumb";
import { ProjectPreview } from "@/components/projects/ProjectVisual";
import { CloseIcon } from "@/components/ui/Icons";
import { Tag } from "@/components/ui/Tag";
import type { ProjectView } from "@/lib/data/loadPortfolio";

export type ProjectLayout = "featured" | "column" | "wide";

/** How many technologies a card shows; the case study lists them all. */
const CARD_TAGS = 4;

const MORPH = { type: "spring", bounce: 0.04, duration: 0.42 } as const;

interface ProjectCardProps {
  project: ProjectView;
  /** 1-based position in the showcase. */
  position: number;
  /** How many projects the showcase holds. */
  total?: number;
  layout?: ProjectLayout;
  /** Development preview only: a withheld repository link is explained to the reviewer. */
  preview?: boolean;
}

function present(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * One project as a compact summary: number, name, category, problem, a few technologies and its
 * screenshot. The card morphs into the full case study (Motion Primitives Morphing Dialog). Without
 * JavaScript the case study is in the card's <noscript>, and the opening button is hidden.
 * Publication gates live in the data layer; this component renders what it receives.
 */
export function ProjectCard({
  project,
  position,
  total,
  layout = "column",
  preview = false,
}: ProjectCardProps) {
  if (!preview && !present(project.repository_url)) {
    console.error(`[ProjectCard] "${project.slug}" has no repository URL and was not rendered.`);
    return null;
  }
  const headingId = `project-${project.slug}`;
  const number = String(position).padStart(2, "0");
  const fileLabel = `Case file ${number}${total ? ` / ${String(total).padStart(2, "0")}` : ""}`;
  const hue = { "--hue": `var(--hue-${project.slug}, var(--accent))` } as React.CSSProperties;
  const extra = project.technologies.length - CARD_TAGS;

  return (
    <MorphingDialog transition={MORPH}>
      {layout === "featured" && (
        <SoftGlow
          className="case-glow"
          colors={[`var(--hue-${project.slug}, var(--accent))`, "var(--blue)"]}
        />
      )}
      <MorphingDialogCard
        className="case"
        style={hue}
        data-layout={layout}
        aria-labelledby={headingId}
        data-testid="project-card"
      >
        <ProjectSpotlight />

        <ProjectThumb>
          <ProjectPreview slug={project.slug} hasScreenshot={project.has_screenshot} />
        </ProjectThumb>

        <div className="case-summary">
          <p className="case-file" aria-hidden="true">
            <span>{fileLabel}</span>
          </p>
          <span className="case-index" aria-hidden="true">
            {number}
          </span>
          <h3 id={headingId} className="display case-name">
            {project.display_name}
          </h3>
          <p className="label mt-2 text-[var(--hue)]" data-testid="project-category">
            {project.category}
          </p>
          <p className="case-problem">{project.problem_statement}</p>
          <Stagger className="mt-4 flex flex-wrap gap-1.5" data-testid="project-tags">
            {project.technologies.slice(0, CARD_TAGS).map((tech) => (
              <Tag key={tech}>{tech}</Tag>
            ))}
            {extra > 0 && <span className="case-more-tags">+{extra}</span>}
          </Stagger>
          <MorphingDialogTrigger
            className="case-open"
            label={`Read case study: ${project.display_name}`}
          >
            Read case study
            <span className="btn-arrow" aria-hidden="true">
              →
            </span>
          </MorphingDialogTrigger>
          <noscript>
            <ProjectCaseStudy project={project} interactive={false} />
          </noscript>
        </div>
      </MorphingDialogCard>

      <MorphingDialogContainer
        className="overlay case-dialog"
        scrimClassName="overlay-scrim"
        testId="case-dialog"
      >
        <div className="case-dialog-frame">
          <MorphingDialogContent className="case-dialog-panel" style={hue}>
            <header className="case-dialog-head">
              <div className="min-w-0">
                <p className="case-file" aria-hidden="true">
                  <span>{fileLabel}</span>
                </p>
                <MorphingDialogTitle className="display case-dialog-title">
                  {project.display_name}
                </MorphingDialogTitle>
                <p className="label mt-2 text-[var(--hue)]">{project.category}</p>
              </div>
              <MorphingDialogClose
                className="overlay-close"
                label={`Close the ${project.display_name} case study`}
                testId="case-dialog-close"
              >
                <CloseIcon />
              </MorphingDialogClose>
            </header>
            <ProjectCaseStudy project={project} />
          </MorphingDialogContent>
        </div>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}
