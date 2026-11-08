import type { ProjectView } from "../../src/lib/data/loadPortfolio";
import type { Links, PublicCertification } from "../../src/lib/validation/schemas";

/** Test fixtures only. Never imported by application code. */
export const fullProject: ProjectView = {
  slug: "fixture-one",
  display_name: "Fixture One",
  category: "Fixture Category",
  problem_statement: "Fixture problem statement.",
  description: "Fixture technical description.",
  technologies: ["Python", "FastAPI", "SQLite"],
  role_statement: "Fixture role statement.",
  repository_url: "https://github.com/example/fixture-one",
  has_screenshot: true,
  highlights: [],
  walkthrough: null,
  demo_url: "https://fixture-one.example.com",
};

export const links: Links = {
  github_url: "https://github.com/singhaasveer-lab",
  linkedin_url: "https://linkedin.com/in/aasveer-singh",
  email: null,
  resume_href: null,
};

export const certifications: PublicCertification[] = Array.from({ length: 12 }, (_, i) => ({
  issuer: `Issuer ${i + 1}`,
  course_name: `Course ${i + 1}`,
  is_prominent: i < 8,
  display_order: i + 1,
  featured: false,
  completed_on: null,
  credential_url: null,
  certificate_url: null,
}));
