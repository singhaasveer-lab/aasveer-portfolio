import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ContentValidationError, readContent } from "../../src/lib/content/readContent";
import { loadPortfolio } from "../../src/lib/data/loadPortfolio";
import { CONTENT_DIR, ROOT, makeContentDir, useTemporaryDatabase } from "../helpers";

const content = readContent(CONTENT_DIR);
const { about, lab, architectures, skillMap, evidence, capabilities, casebook } = content.explorer;
const SLUGS = [
  "interviewiq",
  "wingman-ai",
  "giftbro-ai",
  "studyforge-ai",
  "smartqueue-ai",
  "pennybloom",
];

type Files = Record<string, unknown>;
const breakContent = (mutate: (files: Files) => void) => () => readContent(makeContentDir(mutate));

describe("AI Systems Laboratory content", () => {
  const labModule = (id: string) => lab.find((m) => m.id === id)!;
  const stage = (moduleId: string, stageId: string) =>
    labModule(moduleId).stages.find((s) => s.id === stageId)!;
  const note = (moduleId: string, stageId: string, project: string) =>
    stage(moduleId, stageId).notes.find((n) => n.project === project)!;

  it("covers all six projects, with no project in every module", () => {
    const projectsIn = (id: string) => [
      ...new Set(labModule(id).stages.flatMap((s) => s.notes.map((n) => n.project))),
    ];
    const everywhere = new Set(lab.flatMap((m) => projectsIn(m.id)));
    expect([...everywhere].sort()).toEqual(content.projects.projects.map((p) => p.slug).sort());
    for (const project of everywhere) {
      expect(lab.filter((m) => projectsIn(m.id).includes(project)).length).toBeLessThan(lab.length);
    }
    expect(projectsIn("rag")).toEqual(["wingman-ai", "studyforge-ai", "interviewiq"]);
    expect(projectsIn("llm-evaluation")).toEqual(["interviewiq", "studyforge-ai", "giftbro-ai"]);
    expect(projectsIn("data-analytics")).toEqual(["pennybloom", "smartqueue-ai"]);
  });

  it("shows the stages InterviewIQ's knowledge base does not have", () => {
    const status = (id: string) =>
      stage("rag", id).notes.find((n) => n.project === "interviewiq")!.status;
    expect(status("processing")).toBe("not_used");
    expect(status("generation")).toBe("not_used");
    expect(status("retrieval")).toBe("implemented");
    const note = stage("rag", "retrieval").notes.find((n) => n.project === "interviewiq")!;
    expect(note.summary).toMatch(/no TF-IDF and no embeddings/);
  });

  it("keeps the AI judge to InterviewIQ, and says the throughput chart is simulated", () => {
    const evaluation = stage("llm-evaluation", "evaluation").notes;
    expect(evaluation.filter((n) => n.status === "implemented").map((n) => n.project)).toEqual([
      "interviewiq",
    ]);
    const estimate = stage("data-analytics", "estimate").notes.find(
      (n) => n.project === "smartqueue-ai",
    )!;
    expect(estimate.summary).toMatch(/simulation/);
  });

  it("links the new modules from the skill map", () => {
    expect(skillMap.skills.find((s) => s.id === "gemini")!.lab).toBe("llm-evaluation");
  });

  it("has the seven modules, in page order", () => {
    expect(lab.map((m) => m.id)).toEqual([
      "rag",
      "llm-evaluation",
      "nlp",
      "recommendation",
      "data-analytics",
      "queue",
      "ocr",
    ]);
  });

  it("does not present Wingman AI and StudyForge AI as the same RAG system", () => {
    for (const id of ["chunking", "generation"]) {
      expect(note("rag", id, "wingman-ai").status).toBe("not_used");
      expect(note("rag", id, "studyforge-ai").status).toBe("implemented");
    }
    expect(note("rag", "retrieval", "wingman-ai").code?.text).toContain("ngram_range=(1,2)");
    expect(note("rag", "retrieval", "studyforge-ai").code?.text).toContain("texts + [question]");
  });

  it("separates GiftBro AI's ranking from its Gemini layer", () => {
    const layers = Object.fromEntries(
      labModule("recommendation").stages.map((s) => [s.id, s.layer]),
    );
    expect(layers.ranking).toBe("ranking");
    expect(layers.gemini).toBe("personalization");
    const weights = note("recommendation", "ranking", "giftbro-ai").weights!;
    expect(weights.reduce((sum, w) => sum + w.value, 0)).toBeCloseTo(1);
  });

  it("describes SmartQueue AI's intelligence as rules, with its simulator flagged", () => {
    expect(labModule("queue").intro).toMatch(/rule engine/);
    expect(labModule("queue").simulator).toBe("queue");
  });

  it("claims no measured results", () => {
    const text = JSON.stringify(lab).toLowerCase();
    for (const word of ["accuracy", "benchmark", "f1 score", "users served"]) {
      expect(text).not.toContain(word);
    }
    expect(text).not.toMatch(/\d+(\.\d+)?\s?%/);
  });
});

describe("architecture content", () => {
  it("covers all six projects, each with its own diagram", () => {
    expect(architectures.map((a) => a.slug)).toEqual(SLUGS);
    const shapes = architectures.map((a) => JSON.stringify(a.engineering.at));
    expect(new Set(shapes).size).toBe(6);
  });

  it("places every component in the engineering view and connects it", () => {
    for (const { slug, nodes, engineering } of architectures) {
      const linked = new Set(engineering.edges.flatMap(([from, to]) => [from, to]));
      for (const node of nodes) {
        expect(engineering.at[node.id], `${slug}.${node.id} placed`).toBeDefined();
        expect(linked.has(node.id), `${slug}.${node.id} connected`).toBe(true);
      }
    }
  });

  it("keeps the system view simpler than the engineering view", () => {
    for (const { system, engineering } of architectures) {
      expect(Object.keys(system.at).length).toBeLessThan(Object.keys(engineering.at).length);
    }
  });

  it("records findings from the source code", () => {
    const by = (slug: string) => architectures.find((a) => a.slug === slug)!;
    expect(by("giftbro-ai").engineering.edges).toContainEqual([
      "ranker",
      "gemini",
      "shortlist, Streamlit only",
    ]);
    const queueKinds = by("smartqueue-ai").nodes.map((n) => n.kind);
    expect(queueKinds).not.toContain("server");
  });
});

describe("PennyBloom", () => {
  const penny = architectures.find((a) => a.slug === "pennybloom")!;

  it("shows no authentication, database or AI, which it does not have", () => {
    const labels = penny.nodes.map((n) => n.label.toLowerCase()).join(" ");
    for (const word of ["auth", "login", "sqlite", "gemini", "model"]) {
      expect(labels).not.toContain(word);
    }
    expect(penny.nodes.filter((n) => n.kind === "ai")).toEqual([]);
  });

  it("routes both interfaces through the one shared service", () => {
    expect(penny.engineering.edges).toContainEqual(["cli", "service", "direct calls"]);
    expect(penny.engineering.edges).toContainEqual(["fastapi", "service", "direct calls"]);
  });

  it("links only the skills its source uses", () => {
    const skills = skillMap.edges.filter((e) => e.project === "pennybloom").map((e) => e.skill);
    expect(skills.sort()).toEqual(["fastapi", "react", "tailwind", "typescript", "vite"]);
  });

  it("is in the Laboratory only for its data work, which uses no AI", () => {
    const modules = lab.filter((m) =>
      m.stages.some((s) => s.notes.some((n) => n.project === "pennybloom")),
    );
    expect(modules.map((m) => m.id)).toEqual(["data-analytics"]);
  });
});

describe("About content", () => {
  it("has the five stages, in order", () => {
    expect(about.process.stages.map((s) => s.label)).toEqual([
      "Understand the problem",
      "Design the system",
      "Build the pipeline",
      "Connect the components",
      "Test and refine",
    ]);
  });

  it("states the three principles in the owner's words", () => {
    expect(about.principles.map((p) => [p.label, p.text])).toEqual([
      [
        "Practical AI",
        "I enjoy building practical applications that use AI to address real problems rather than treating models as isolated demonstrations.",
      ],
      [
        "Systems Thinking",
        "I am interested in bringing together intelligent systems, data processing, backend engineering, APIs and user-facing interfaces.",
      ],
      [
        "Human-Centred Engineering",
        "The usefulness of an intelligent system depends on how well its different components work together for the person using it.",
      ],
    ]);
  });

  it("draws the perspective in order, from real skills and interests only", () => {
    expect(about.perspective.stages.map((s) => s.label)).toEqual([
      "Problem",
      "Intelligence",
      "Engineering",
      "Experience",
    ]);
    const known = new Set([...content.skills.groups.flatMap((g) => g.skills), ...about.interests]);
    for (const stage of about.perspective.stages) {
      for (const name of stage.grounded_in) expect(known.has(name), name).toBe(true);
    }
    expect(about.perspective.note).toMatch(/not the architecture of any one project/);
  });

  it("does not overstate experience", () => {
    const text = JSON.stringify({ ...about, topics: [] }).toLowerCase();
    for (const word of ["years of", "senior", "award", "worked at", "expert", "results-driven"]) {
      expect(text).not.toContain(word);
    }
  });

  it("shows the approved portrait, unchanged, and publishes no other copy of the photograph", () => {
    const file = path.join(ROOT, "public", about.portrait.src!);
    expect(about.portrait.src).toBe("/images/aasveer-portrait-cutout.webp");
    // The Hero portrait's exact bytes: any edit, recompression or replacement fails here.
    const hash = createHash("md5").update(fs.readFileSync(file)).digest("hex");
    expect(hash).toBe("32c69aeebca1a94151505308b4418618");
    expect(fs.existsSync(path.join(ROOT, "public/images/aasveer-portrait.png"))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, "public/image"))).toBe(false);
  });

  it("has earlier education from the resume, with no grades", () => {
    expect(about.earlier_education).toEqual([
      { level: "Class XII", institution: "Shri Guru Harkishan Sen. Sec. School", year: "2023" },
      { level: "Class X", institution: "Shri Guru Harkishan Public School", year: "2021" },
    ]);
  });
});

describe("skill map content", () => {
  const projectsOf = (skill: string) =>
    skillMap.edges.filter((e) => e.skill === skill).map((e) => e.project);

  it("includes every starting relationship", () => {
    const expected: Record<string, string[]> = {
      rag: ["wingman-ai", "studyforge-ai"],
      nlp: ["wingman-ai", "studyforge-ai"],
      fastapi: ["wingman-ai", "giftbro-ai", "studyforge-ai"],
      sqlite: ["wingman-ai", "giftbro-ai", "studyforge-ai"],
      "tf-idf": ["wingman-ai", "giftbro-ai"],
      gemini: ["giftbro-ai", "studyforge-ai"],
      ocr: ["wingman-ai"],
    };
    for (const [skill, projects] of Object.entries(expected)) {
      expect(projectsOf(skill)).toEqual(expect.arrayContaining(projects));
    }
  });

  it("links OCR only to the project that uses it", () => {
    expect(projectsOf("ocr")).toEqual(["wingman-ai"]);
  });

  it("names the evidence for every link, once", () => {
    const keys = skillMap.edges.map((e) => `${e.skill}:${e.project}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const edge of skillMap.edges) expect(edge.evidence).toMatch(/\.\w+$/);
  });

  it("connects every project and every skill", () => {
    for (const slug of SLUGS) expect(skillMap.edges.some((e) => e.project === slug)).toBe(true);
    for (const skill of skillMap.skills) expect(projectsOf(skill.id).length).toBeGreaterThan(0);
  });

  it("has no ratings or proficiency scores", () => {
    const text = JSON.stringify({ ...skillMap, skills: skillMap.skills }).toLowerCase();
    expect(text).not.toMatch(/\d+\s?%|proficien|years of experience|\brating\b/);
  });
});

describe("cross-file validation", () => {
  it("rejects a portrait outside public/images", () => {
    expect(
      breakContent((files) => {
        (files["about.json"] as { portrait: { src: string } }).portrait.src = "/stock/face.jpg";
      }),
    ).toThrow(ContentValidationError);
  });

  it("rejects a skill-map edge to an unknown project", () => {
    expect(
      breakContent((files) => {
        (files["skill-map.json"] as { edges: { project: string }[] }).edges[0]!.project = "nope";
      }),
    ).toThrow(ContentValidationError);
  });

  it("rejects a skill that is not in content/skills.json", () => {
    expect(
      breakContent((files) => {
        (files["skill-map.json"] as { skills: { skill: string }[] }).skills[0]!.skill = "Invented";
      }),
    ).toThrow(/not in content\/skills\.json/);
  });

  it("rejects a skill rating field", () => {
    expect(
      breakContent((files) => {
        (files["skill-map.json"] as { skills: object[] }).skills[0] = {
          ...(files["skill-map.json"] as { skills: object[] }).skills[0],
          proficiency: 90,
        };
      }),
    ).toThrow(ContentValidationError);
  });

  it("rejects a project with no architecture", () => {
    expect(
      breakContent((files) => {
        (files["architecture.json"] as { architectures: unknown[] }).architectures.pop();
      }),
    ).toThrow(/project has no architecture/);
  });

  it("rejects an edge to a component the view does not place", () => {
    expect(
      breakContent((files) => {
        const doc = files["architecture.json"] as {
          architectures: { engineering: { edges: string[][] } }[];
        };
        doc.architectures[0]!.engineering.edges[0]![1] = "ghost";
      }),
    ).toThrow(/not placed in this view/);
  });

  it("rejects a flow that does not follow the edges", () => {
    expect(
      breakContent((files) => {
        const doc = files["architecture.json"] as {
          architectures: { engineering: { flows: { path: string[] }[] } }[];
        };
        doc.architectures[0]!.engineering.flows[0]!.path.reverse();
      }),
    ).toThrow(/has no edge/);
  });

  it("rejects a compared stage that leaves one project out", () => {
    expect(
      breakContent((files) => {
        const doc = files["lab.json"] as { modules: { stages: { notes: unknown[] }[] }[] };
        doc.modules[0]!.stages[0]!.notes.pop();
      }),
    ).toThrow(/no note for/);
  });
});

describe("loadPortfolio explorer data", () => {
  let restore = () => {};
  afterEach(() => {
    restore();
    restore = () => {};
  });

  it("returns the explorer content through the database", () => {
    const { explorer } = loadPortfolio();
    expect(explorer.lab).toHaveLength(7);
    expect(explorer.architectures).toHaveLength(6);
    expect(explorer.evidence.records).toHaveLength(evidence.records.length);
    expect(explorer.skillMap.edges).toHaveLength(skillMap.edges.length);
  });

  it("keeps a draft project out of every explorer", () => {
    const dir = makeContentDir((files) => {
      const doc = files["projects.json"] as {
        projects: { slug: string; publish_status: string }[];
      };
      doc.projects.find((p) => p.slug === "smartqueue-ai")!.publish_status = "draft";
    });
    restore = useTemporaryDatabase(dir);
    const { explorer, projects } = loadPortfolio();
    expect(projects.map((p) => p.slug)).not.toContain("smartqueue-ai");
    expect(explorer.architectures.map((a) => a.slug)).not.toContain("smartqueue-ai");
    expect(explorer.lab.map((m) => m.id)).not.toContain("queue");
    expect(explorer.skillMap.edges.map((e) => e.project)).not.toContain("smartqueue-ai");
    const evidenceProjects = explorer.evidence.records.flatMap((r) =>
      r.applications.map((a) => a.project),
    );
    expect(evidenceProjects).not.toContain("smartqueue-ai");
    expect(explorer.evidence.records.map((r) => r.id)).not.toContain("queue");
    expect(explorer.evidence.quick_view.map((q) => q.project)).not.toContain("smartqueue-ai");
  });
});

describe("Evidence Engine content", () => {
  const repoOf = (slug: string) =>
    content.projects.projects.find((p) => p.slug === slug)!.repository_url as string;
  const items = evidence.records.flatMap((r) =>
    r.applications.flatMap((a) => a.evidence.map((e) => ({ ...e, project: a.project }))),
  );

  it("links every evidence item into its own project's public repository", () => {
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.inspected).toBe(true);
      expect(item.url).toBe(`${repoOf(item.project)}/blob/main/${item.path}`);
    }
  });

  it("never exposes a local filesystem path", () => {
    const text = JSON.stringify(evidence);
    expect(text).not.toMatch(/[A-Z]:\\|\/Users\/|Desktop|OneDrive|private\//i);
    for (const item of items) expect(item.path).not.toMatch(/^\/|\.\./);
  });

  it("claims a contribution only where the owner approved its wording", () => {
    const status = Object.fromEntries(
      evidence.records.flatMap((r) =>
        r.applications.map((a) => [a.project, a.contribution_status] as const),
      ),
    );
    expect(status["wingman-ai"]).toBe("approved");
    expect(status["studyforge-ai"]).toBe("approved");
    expect(status["giftbro-ai"]).toBe("approved");
    expect(status["smartqueue-ai"]).toBe("approved");
    expect(status["interviewiq"]).toBe("unconfirmed");
    expect(status["pennybloom"]).toBe("unconfirmed");
    for (const r of evidence.records) {
      for (const a of r.applications) {
        expect(a.contribution === undefined, `${r.id}/${a.project}`).toBe(
          a.contribution_status === "unconfirmed",
        );
      }
    }
  });

  it("does not claim an AI model for SmartQueue", () => {
    const queue = evidence.records.find((r) => r.id === "queue")!;
    expect(queue.summary).toMatch(/No AI model is involved/);
    const sq = content.projects.projects.find((p) => p.slug === "smartqueue-ai")!;
    expect(sq.display_name).toBe("SmartQueue AI");
    expect(JSON.stringify([sq.category, sq.description, sq.problem_statement])).not.toMatch(
      /AI[- ]powered|machine learning|neural|trained model/i,
    );
    expect(lab.find((m) => m.id === "queue")!.label).not.toMatch(/AI[- ]powered/i);
  });

  it("offers at most three quick-view contributions, each a real record and project", () => {
    expect(evidence.quick_view.length).toBeLessThanOrEqual(3);
    for (const q of evidence.quick_view) {
      const record = evidence.records.find((r) => r.id === q.record)!;
      const application = record.applications.find((a) => a.project === q.project)!;
      expect(application.contribution_status).toBe("approved");
    }
  });

  it("rejects an evidence link outside the project's repository", () => {
    const dir = makeContentDir((files) => {
      const doc = files["evidence.json"] as {
        records: { applications: { evidence: { url?: string }[] }[] }[];
      };
      doc.records[0]!.applications[0]!.evidence[0]!.url =
        "https://github.com/someone/else/blob/main/x.py";
    });
    expect(() => readContent(dir)).toThrow(/evidence/);
  });
});

describe("Laboratory capability map content", () => {
  it("keeps the twelve peer capabilities, the original six first", () => {
    expect(capabilities.map((c) => c.label)).toEqual([
      "RAG and Retrieval Systems",
      "Generative AI and LLM Applications",
      "NLP",
      "Recommendation Engines",
      "Backend and API Engineering",
      "Intelligent Data Applications",
      "Machine Learning",
      "OCR and Document Intelligence",
      "AI Models and Platforms",
      "Data and Database Systems",
      "Frontend Engineering",
      "Analytics and Forecasting",
    ]);
  });

  it("links only real projects and real Laboratory modules", () => {
    const slugs = new Set(SLUGS);
    const modules = new Set(lab.map((m) => m.id));
    for (const c of capabilities) {
      expect(c.projects.length).toBeGreaterThan(0);
      for (const p of c.projects) expect(slugs.has(p.slug)).toBe(true);
      if (c.lab) expect(modules.has(c.lab)).toBe(true);
    }
    expect(
      capabilities.find((c) => c.id === "recommendation")!.projects.map((p) => p.slug),
    ).toEqual(["giftbro-ai"]);
  });

  it("rejects a capability linked to an unknown project", () => {
    expect(
      breakContent((files) => {
        const doc = files["capabilities.json"] as {
          capabilities: { projects: { slug: string }[] }[];
        };
        doc.capabilities[0]!.projects[0]!.slug = "nope";
      }),
    ).toThrow(/unknown project/);
  });

  it("drops a hidden project from the map", () => {
    const dir = makeContentDir((files) => {
      const doc = files["projects.json"] as {
        projects: { slug: string; publish_status: string }[];
      };
      doc.projects.find((p) => p.slug === "smartqueue-ai")!.publish_status = "draft";
    });
    const restore = useTemporaryDatabase(dir);
    try {
      const { explorer } = loadPortfolio();
      const linked = explorer.capabilities.flatMap((c) => c.projects.map((p) => p.slug));
      expect(linked).not.toContain("smartqueue-ai");
    } finally {
      restore();
    }
  });
});

describe("Engineering Casebook content", () => {
  const repoOf = (slug: string) =>
    content.projects.projects.find((p) => p.slug === slug)!.repository_url as string;

  it("tells three cases, from projects with a confirmed or stated contribution", () => {
    expect(casebook.map((c) => c.project)).toEqual(["studyforge-ai", "wingman-ai", "giftbro-ai"]);
    for (const c of casebook) expect(c.contribution_status).toBe("approved");
  });

  it("uses the owner's wording for each contribution", () => {
    const by = (slug: string) => casebook.find((c) => c.project === slug)!.contribution;
    expect(by("studyforge-ai")).toBe("RAG, study planning, quizzes, NLP, FastAPI and SQLite.");
    expect(by("wingman-ai")).toMatch(
      /^Backend, local RAG and NLP, OCR, Reply Lab and Dating Tips\./,
    );
    expect(by("giftbro-ai")).toBe(
      "TF-IDF, cosine similarity, weighted recommendation scoring and Gemini personalization.",
    );
  });

  it("links every source into its own project's public repository", () => {
    for (const c of casebook) {
      expect(c.sources.length).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.url).toBe(`${repoOf(c.project)}/blob/main/${s.path}`);
    }
  });

  it("claims no metrics, user numbers or local paths", () => {
    const text = JSON.stringify(casebook);
    expect(text).not.toMatch(/\d+\s?%|\busers\b|faster|\d+\s?ms\b|Desktop|OneDrive|[A-Z]:\\/);
  });

  it("rejects a case source outside the project's repository", () => {
    expect(
      breakContent((files) => {
        const doc = files["casebook.json"] as { cases: { sources: { url: string }[] }[] };
        doc.cases[0]!.sources[0]!.url = "https://github.com/someone/else/blob/main/x.py";
      }),
    ).toThrow(/casebook/);
  });
});
