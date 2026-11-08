// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectCard } from "../../src/components/projects/ProjectCard";
import { ProjectCaseStudy } from "../../src/components/projects/ProjectCaseStudy";
import { ProjectVisual } from "../../src/components/projects/ProjectVisual";
import {
  PROJECTS_EMPTY_TEXT,
  ProjectsSection,
} from "../../src/components/projects/ProjectsSection";
import { readContent } from "../../src/lib/content/readContent";
import { CONTENT_DIR, resumeTechStacks } from "../helpers";
import { fullProject } from "./fixtures";

afterEach(cleanup);

const five = [1, 2, 3, 4, 5].map((n) => ({
  ...fullProject,
  slug: `fixture-${n}`,
  display_name: `Fixture ${n}`,
}));

describe("ProjectsSection", () => {
  it("renders five cards in the order given", () => {
    render(<ProjectsSection projects={five} />);
    const names = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(names).toEqual(["Fixture 1", "Fixture 2", "Fixture 3", "Fixture 4", "Fixture 5"]);
  });

  it("features the first of five full width and pairs the other four in two rows", () => {
    const { container } = render(<ProjectsSection projects={five} />);
    const spans = [...container.querySelectorAll("ol > li")].map((li) =>
      li.className.includes("lg:col-span-12") ? 12 : 6,
    );
    expect(spans).toEqual([12, 6, 6, 6, 6]);
  });

  it("renders only the empty-state text when there are no projects", () => {
    const { container } = render(<ProjectsSection projects={[]} />);
    expect(container.textContent).toBe(PROJECTS_EMPTY_TEXT);
    expect(container.querySelector("article")).toBeNull();
    expect(container.textContent).not.toMatch(
      /draft|pending|approv|review|coming soon|placeholder/i,
    );
  });
});

describe("ProjectCard", () => {
  it("summarises the project: number, name, category, problem and up to four technologies", () => {
    const technologies = ["A", "B", "C", "D", "E", "F"];
    const { container } = render(
      <ProjectCard project={{ ...fullProject, technologies }} position={3} total={6} />,
    );
    const article = container.querySelector("article")!;
    expect(article.querySelectorAll("h1, h2, h3, h4")).toHaveLength(1);
    expect(screen.getByTestId("project-category").textContent).toBe("Fixture Category");
    expect(article.textContent).toContain("Case file 03 / 06");
    expect(article.textContent).toContain("Fixture problem statement.");
    expect(article.textContent).not.toContain("Fixture technical description.");
    const tags = within(screen.getByTestId("project-tags"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(tags).toEqual(["A", "B", "C", "D", "+2"]);
    expect(screen.getByRole("button", { name: "Read case study: Fixture One" })).toBeDefined();
  });
});

describe("ProjectCaseStudy", () => {
  it("renders problem, approach, ordered technologies, role and links, in that order", () => {
    const { container } = render(<ProjectCaseStudy project={fullProject} />);
    const text = container.textContent!;
    const order = [
      "Fixture problem statement.",
      "Fixture technical description.",
      "Python",
      "Fixture role statement.",
      "Fixture One repository",
    ];
    const positions = order.map((s) => text.indexOf(s));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    const tags = within(screen.getByTestId("project-technologies"))
      .getAllByRole("listitem")
      .map((li) => li.textContent);
    expect(tags).toEqual(["Python", "FastAPI", "SQLite"]);
  });

  it("omits the role block entirely when the statement is null or empty", () => {
    for (const role_statement of [null, "  "]) {
      const { container } = render(
        <ProjectCaseStudy project={{ ...fullProject, role_statement }} />,
      );
      expect(screen.queryByTestId("project-role")).toBeNull();
      expect(container.textContent).not.toMatch(/Contribution/);
      cleanup();
    }
  });

  it("renders the demo link only when demo_url is set, with the required labels and attributes", () => {
    render(<ProjectCaseStudy project={fullProject} />);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual([
      expect.stringContaining("Fixture One repository (opens in a new tab)"),
      expect.stringContaining("Live demo (opens in a new tab)"),
    ]);
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
    cleanup();
    render(<ProjectCaseStudy project={{ ...fullProject, demo_url: null }} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("ProjectCard without a repository", () => {
  it("renders nothing, and reports, for a project without a repository URL", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = render(
      <ProjectCard project={{ ...fullProject, repository_url: "" }} position={1} />,
    );
    expect(container.innerHTML).toBe("");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("no repository URL"));
    spy.mockRestore();
  });
});

describe("ProjectCard in the development preview", () => {
  it("renders an unverified entry without any external link or contribution block", () => {
    const project = {
      ...fullProject,
      repository_url: null,
      demo_url: null,
      role_statement: null,
    };
    render(<ProjectCard project={project} position={2} preview />);
    expect(document.querySelector("article")).not.toBeNull();
    cleanup();
    const { container } = render(<ProjectCaseStudy project={project} />);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(screen.queryByTestId("project-role")).toBeNull();
    expect(screen.getByTestId("project-link-withheld")).toBeDefined();
  });
});

describe("ProjectVisual", () => {
  const slugs = readContent(CONTENT_DIR).projects.projects.map((p) => p.slug);

  it("gives every project its own labelled pipeline", () => {
    const flows = slugs.map((slug) => {
      render(<ProjectVisual slug={slug} hasScreenshot={slug !== "studyforge-ai"} />);
      const flow = screen.getByTestId("project-flow");
      const stages = within(flow)
        .getAllByRole("listitem")
        .map((li) => li.textContent);
      cleanup();
      expect(stages.length, slug).toBeGreaterThanOrEqual(4);
      return stages.join(" > ");
    });
    expect(new Set(flows).size).toBe(slugs.length);
  });

  it("shows a described real screenshot, or a described diagram where none exists", () => {
    for (const slug of slugs) {
      const { container } = render(
        <ProjectVisual slug={slug} hasScreenshot={slug !== "studyforge-ai"} />,
      );
      const described = container.querySelector("img[alt], svg[aria-label]");
      expect(described, slug).not.toBeNull();
      cleanup();
    }
    render(<ProjectVisual slug="studyforge-ai" hasScreenshot={false} />);
    expect(screen.getByRole("img").tagName.toLowerCase()).toBe("svg");
  });

  it("shows StudyForge AI's screenshot, like the others, once the file exists", () => {
    const { container } = render(<ProjectVisual slug="studyforge-ai" hasScreenshot />);
    expect(decodeURIComponent(container.querySelector("img")!.getAttribute("src")!)).toContain(
      "/images/projects/studyforge-ai.webp",
    );
    expect(container.querySelector(".study-diagram")).toBeNull();
  });

  it("labels demo data as demo data", () => {
    const { container } = render(<ProjectVisual slug="pennybloom" hasScreenshot />);
    expect(container.querySelector("figcaption")!.textContent).toContain("demo data");
  });

  it("renders nothing for an unknown project", () => {
    const { container } = render(<ProjectVisual slug="unknown-slug" hasScreenshot={false} />);
    expect(container.querySelector("img, svg, ol")).toBeNull();
  });
});

describe("technology lists against the resume fixture", () => {
  it("each project's technologies equal its resume Tech Stack line, in order", () => {
    const stacks = resumeTechStacks();
    const { projects } = readContent(CONTENT_DIR).projects;
    // PennyBloom is newer than the resume, so its list comes from its source code.
    for (const p of projects.filter((x) => x.slug !== "pennybloom")) {
      expect(p.technologies).toEqual(stacks.get(p.resume_name));
    }
  });
});
