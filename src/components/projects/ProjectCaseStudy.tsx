import { ArchitectureTrigger } from "@/components/explorer/architecture/ArchitectureTrigger";
import { ProjectHighlights } from "@/components/projects/ProjectHighlights";
import { ProjectLinks } from "@/components/projects/ProjectLinks";
import { ProjectVisual } from "@/components/projects/ProjectVisual";
import { ProjectWalkthrough } from "@/components/projects/ProjectWalkthrough";
import { Tag } from "@/components/ui/Tag";
import type { ProjectView } from "@/lib/data/loadPortfolio";

function present(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * A project in full: its real interface and pipeline, the approach, every technology, then the
 * approved contribution, results and walkthrough where they exist, and its links. The same content
 * opens in the case study dialog and sits in the card's <noscript>, so it needs no JavaScript.
 */
export function ProjectCaseStudy({
  project,
  interactive = true,
}: {
  project: ProjectView;
  /** Leaves out the architecture explorer, which needs JavaScript. */
  interactive?: boolean;
}) {
  return (
    <div className="case-study">
      <ProjectVisual
        slug={project.slug}
        name={project.display_name}
        hasScreenshot={project.has_screenshot}
        interactive={interactive}
      />

      <div className="case-study-text">
        <div>
          <p className="label">Problem</p>
          <p className="mt-2 text-[1.05rem] leading-relaxed text-text">
            {project.problem_statement}
          </p>
        </div>
        <div>
          <p className="label">Approach</p>
          <p className="mt-2 leading-relaxed text-muted">{project.description}</p>
        </div>
        <ProjectHighlights highlights={project.highlights} />
        <ProjectWalkthrough walkthrough={project.walkthrough} />
        <div>
          <p className="label">Technologies</p>
          <ul className="mt-3 flex flex-wrap gap-1.5" data-testid="project-technologies">
            {project.technologies.map((tech) => (
              <li key={tech}>
                <Tag>{tech}</Tag>
              </li>
            ))}
          </ul>
        </div>
        {present(project.role_statement) && (
          <div className="case-role" data-testid="project-role">
            <p className="label">Contribution</p>
            <p className="mt-2 text-text">{project.role_statement}</p>
          </div>
        )}
        <div className="grid gap-4">
          {interactive && <ArchitectureTrigger slug={project.slug} name={project.display_name} />}
          {present(project.repository_url) ? (
            <ProjectLinks
              displayName={project.display_name}
              repositoryUrl={project.repository_url}
              demoUrl={project.demo_url}
            />
          ) : (
            <p
              className="font-mono text-xs leading-relaxed text-faint"
              data-testid="project-link-withheld"
            >
              Preview: repository link withheld until it is verified.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
