import type { ProjectView } from "../data/loadPortfolio";
import { CONNECTIONS_ID, SECTION_IDS } from "../sections";
import type { Links } from "../validation/schemas";
import type { LabModule } from "./schema";

export type CommandAction =
  | { type: "section"; id: string }
  | { type: "lab"; module: string }
  | { type: "architecture"; slug: string }
  | { type: "download"; href: string }
  | { type: "external"; href: string };

export interface Command {
  id: string;
  label: string;
  hint: string;
  group: "Navigate" | "AI Systems Lab" | "Projects" | "Connect";
  keywords: string;
  action: CommandAction;
}

const section = (
  id: string,
  label: string,
  hint: string,
  keywords: string,
  group: Command["group"] = "Navigate",
): Command => ({
  id: `section-${id}`,
  label,
  hint,
  group,
  keywords,
  action: { type: "section", id },
});

/** Every command, built from the page's own data, so a new project or module appears by itself. */
export function buildCommands(input: {
  modules: LabModule[];
  projects: Pick<ProjectView, "slug" | "display_name" | "category">[];
  links: Links;
}): Command[] {
  const { modules, projects, links } = input;
  const commands: Command[] = [
    section(
      SECTION_IDS.about,
      "GO TO ABOUT",
      "The engineer behind the systems",
      "engineer person profile",
    ),
    section(
      CONNECTIONS_ID,
      "VIEW ENGINEERING CONNECTIONS",
      "Skills applied across projects",
      "skill map matrix table connections",
    ),
    section(
      SECTION_IDS.evidence,
      "OPEN EVIDENCE ENGINE",
      "Source behind every claim",
      "proof verify github source recruiter",
    ),
    section(
      SECTION_IDS.projects,
      "GO TO PROJECTS",
      `${projects.length} case files`,
      "work portfolio",
    ),
    section(SECTION_IDS.skills, "GO TO SKILLS", "Technical skills", "technologies stack"),
    section(
      SECTION_IDS.casebook,
      "OPEN ENGINEERING CASEBOOK",
      "Behind the build",
      "case studies decisions challenges engineering stories",
    ),
    section(SECTION_IDS.lab, "OPEN AI SYSTEMS LAB", "Interactive pipelines", "laboratory ai-lab"),
    section(SECTION_IDS.education, "GO TO EDUCATION", "Degree and certifications", "certificates"),
  ];

  for (const lab of modules) {
    commands.push({
      id: `lab-${lab.id}`,
      label: lab.command,
      hint: lab.label,
      group: "AI Systems Lab",
      keywords: `${lab.label} ${lab.short} ${lab.keywords.join(" ")}`,
      action: { type: "lab", module: lab.id },
    });
  }

  for (const project of projects) {
    commands.push({
      id: `project-${project.slug}`,
      label: `EXPLORE ${project.display_name.toUpperCase()}`,
      hint: "Architecture explorer",
      group: "Projects",
      keywords: `${project.display_name} ${project.category} architecture diagram open`,
      action: { type: "architecture", slug: project.slug },
    });
  }

  commands.push(
    section(
      SECTION_IDS.contact,
      "CONTACT AASVEER",
      "Contact section",
      "hire reach talk",
      "Connect",
    ),
  );
  if (links.resume_href) {
    commands.push({
      id: "resume",
      label: "DOWNLOAD RESUME",
      hint: "PDF",
      group: "Connect",
      keywords: "cv pdf",
      action: { type: "download", href: links.resume_href },
    });
  }
  commands.push(
    {
      id: "github",
      label: "OPEN GITHUB",
      hint: "Opens in a new tab",
      group: "Connect",
      keywords: "code repositories",
      action: { type: "external", href: links.github_url },
    },
    {
      id: "linkedin",
      label: "OPEN LINKEDIN",
      hint: "Opens in a new tab",
      group: "Connect",
      keywords: "profile network",
      action: { type: "external", href: links.linkedin_url },
    },
  );
  return commands;
}

/**
 * Every word typed must appear somewhere in the command, in any order. Commands whose label holds
 * all the words come first, so typing a project's name puts that project above a module that
 * merely mentions it.
 */
export function filterCommands(commands: readonly Command[], query: string): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...commands];
  const has = (text: string) => {
    const haystack = text.toLowerCase();
    return words.every((word) => haystack.includes(word));
  };
  const matches = commands.filter((c) => has(`${c.label} ${c.hint} ${c.group} ${c.keywords}`));
  return [...matches.filter((c) => has(c.label)), ...matches.filter((c) => !has(c.label))];
}
