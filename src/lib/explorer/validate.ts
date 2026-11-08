import type { ProjectsContent, SkillsContent } from "../validation/schemas";
import type { Architecture, ArchitectureView, ExplorerContent } from "./schema";

/** One broken reference, in the shape ContentValidationError reports. */
export interface ReferenceIssue {
  file: string;
  path: string;
  message: string;
}

function checkView(architecture: Architecture, name: "system" | "engineering") {
  const view: ArchitectureView = architecture[name];
  const known = new Set(architecture.nodes.map((n) => n.id));
  const path = `${architecture.slug}.${name}`;
  const issues: string[] = [];

  for (const [node, [col, row]] of Object.entries(view.at)) {
    if (!known.has(node)) issues.push(`${path}.at: unknown node "${node}"`);
    if (col >= view.cols || row >= view.rows) issues.push(`${path}.at: "${node}" is off the grid`);
  }
  const places = Object.values(view.at).map((p) => p.join(","));
  if (new Set(places).size !== places.length) issues.push(`${path}.at: two nodes share a cell`);

  const links = new Set<string>();
  for (const [from, to] of view.edges) {
    for (const end of [from, to]) {
      if (!view.at[end]) issues.push(`${path}.edges: "${end}" is not placed in this view`);
    }
    links.add(`${from}>${to}`);
  }
  for (const flow of view.flows ?? []) {
    flow.path.slice(1).forEach((to, i) => {
      if (!links.has(`${flow.path[i]}>${to}`)) {
        issues.push(`${path}.flows: "${flow.label}" has no edge ${flow.path[i]} to ${to}`);
      }
    });
  }
  return issues;
}

/**
 * Rules that span content files: every project, layer, node and skill named anywhere must exist,
 * every project needs an architecture, and a module with several projects must describe each
 * stage for all of them, so that comparing two implementations never hits a gap.
 */
export function explorerReferenceIssues(
  explorer: ExplorerContent,
  projects: ProjectsContent,
  skills: SkillsContent,
): ReferenceIssue[] {
  const issues: ReferenceIssue[] = [];
  const add = (file: string, path: string, message: string) => issues.push({ file, path, message });
  const slugs = new Set(projects.projects.map((p) => p.slug));

  for (const lab of explorer.lab) {
    const layers = new Set(lab.layers.map((l) => l.id));
    const variants = new Set(lab.stages.flatMap((s) => s.notes.map((n) => n.project)));
    for (const stage of lab.stages) {
      const at = `${lab.id}.${stage.id}`;
      if (!layers.has(stage.layer)) add("lab.json", at, `unknown layer "${stage.layer}"`);
      for (const note of stage.notes) {
        if (!slugs.has(note.project)) add("lab.json", at, `unknown project "${note.project}"`);
      }
      const covered = new Set(stage.notes.map((n) => n.project));
      for (const variant of variants) {
        if (!covered.has(variant)) add("lab.json", at, `no note for "${variant}"`);
      }
    }
  }

  const architectures = new Set(explorer.architectures.map((a) => a.slug));
  for (const slug of slugs) {
    if (!architectures.has(slug)) add("architecture.json", slug, "project has no architecture");
  }
  for (const architecture of explorer.architectures) {
    if (!slugs.has(architecture.slug)) {
      add("architecture.json", architecture.slug, "unknown project");
    }
    for (const name of ["system", "engineering"] as const) {
      for (const message of checkView(architecture, name)) {
        add("architecture.json", architecture.slug, message);
      }
    }
  }

  const skillNames = new Set(skills.groups.flatMap((g) => g.skills));
  const modules = new Set(explorer.lab.map((m) => m.id));

  const grounded = new Set([...skillNames, ...explorer.about.interests]);
  for (const stage of explorer.about.perspective.stages) {
    for (const name of stage.grounded_in) {
      if (!grounded.has(name)) add("about.json", stage.id, `"${name}" is not a skill or interest`);
    }
  }
  for (const stage of explorer.about.process.stages) {
    if (!slugs.has(stage.example.project)) {
      add("about.json", stage.id, `unknown project "${stage.example.project}"`);
    }
  }

  const mapSkills = new Set(explorer.skillMap.skills.map((s) => s.id));
  for (const skill of explorer.skillMap.skills) {
    if (!skillNames.has(skill.skill)) {
      add("skill-map.json", skill.id, `"${skill.skill}" is not in content/skills.json`);
    }
    if (skill.lab && !modules.has(skill.lab)) {
      add("skill-map.json", skill.id, `unknown lab module "${skill.lab}"`);
    }
  }
  for (const edge of explorer.skillMap.edges) {
    const at = `${edge.skill}:${edge.project}`;
    if (!mapSkills.has(edge.skill)) add("skill-map.json", at, "unknown skill");
    if (!slugs.has(edge.project)) add("skill-map.json", at, "unknown project");
  }

  // Capability map: real projects and real Laboratory modules only.
  const labIds = new Set(explorer.lab.map((m) => m.id));
  const capabilityIds = new Set<string>();
  for (const capability of explorer.capabilities) {
    if (capabilityIds.has(capability.id))
      add("capabilities.json", capability.id, "duplicate capability id");
    capabilityIds.add(capability.id);
    if (capability.lab && !labIds.has(capability.lab))
      add("capabilities.json", capability.id, `unknown lab module "${capability.lab}"`);
    const seen = new Set<string>();
    for (const use of capability.projects) {
      if (!slugs.has(use.slug))
        add("capabilities.json", `${capability.id}.${use.slug}`, `unknown project "${use.slug}"`);
      if (seen.has(use.slug))
        add("capabilities.json", `${capability.id}.${use.slug}`, "project listed twice");
      seen.add(use.slug);
    }
  }

  // Casebook: real projects, and sources only inside that project's own repository.
  const caseIds = new Set<string>();
  for (const study of explorer.casebook) {
    if (caseIds.has(study.id)) add("casebook.json", study.id, "duplicate case id");
    caseIds.add(study.id);
    const project = projects.projects.find((p) => p.slug === study.project);
    if (!project) {
      add("casebook.json", study.id, `unknown project "${study.project}"`);
      continue;
    }
    for (const source of study.sources) {
      const expected = `${project.repository_url}/blob/main/${source.path}`;
      if (source.url !== expected)
        add(
          "casebook.json",
          `${study.id}.${source.path}`,
          `link is not ${source.path} in ${project.repository_url}`,
        );
    }
  }

  // Evidence: real projects only, and a link may point only at its own project's repository.
  const repositories = new Map(projects.projects.map((p) => [p.slug, p.repository_url]));
  const records = new Set<string>();
  for (const record of explorer.evidence.records) {
    if (records.has(record.id)) add("evidence.json", record.id, "duplicate record id");
    records.add(record.id);
    for (const application of record.applications) {
      const at = `${record.id}.${application.project}`;
      const repository = repositories.get(application.project);
      if (!repository) {
        add("evidence.json", at, `unknown project "${application.project}"`);
        continue;
      }
      for (const item of application.evidence) {
        if (item.url && item.url !== `${repository}/blob/main/${item.path}`) {
          add("evidence.json", `${at}.${item.path}`, `link is not ${item.path} in ${repository}`);
        }
        if (item.url && !item.inspected) {
          add("evidence.json", `${at}.${item.path}`, "a public link needs an inspected file");
        }
      }
    }
  }
  for (const quick of explorer.evidence.quick_view) {
    const record = explorer.evidence.records.find((r) => r.id === quick.record);
    if (!record) add("evidence.json", `quick_view.${quick.record}`, "unknown record");
    else if (!record.applications.some((a) => a.project === quick.project)) {
      add(
        "evidence.json",
        `quick_view.${quick.record}`,
        `"${quick.project}" is not in that record`,
      );
    }
  }
  return issues;
}
