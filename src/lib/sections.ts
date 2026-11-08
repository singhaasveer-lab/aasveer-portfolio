/** Section IDs and navigation labels for the single page, in page order. */
export const SECTION_IDS = {
  intro: "intro",
  about: "about",
  evidence: "evidence",
  projects: "projects",
  skills: "skills",
  casebook: "casebook",
  lab: "ai-lab",
  education: "education-certifications",
  contact: "contact",
} as const;

/** Every scroll scene in page order, for the scene indicator. */
export const SCENES = [
  { id: SECTION_IDS.intro, label: "Intro" },
  { id: SECTION_IDS.about, label: "About" },
  { id: SECTION_IDS.evidence, label: "Evidence" },
  { id: SECTION_IDS.projects, label: "Projects" },
  { id: SECTION_IDS.skills, label: "Skills" },
  { id: SECTION_IDS.casebook, label: "Casebook" },
  { id: SECTION_IDS.lab, label: "AI Lab" },
  { id: SECTION_IDS.education, label: "Education" },
  { id: SECTION_IDS.contact, label: "Contact" },
] as const;

/** Engineering Connections: a subsection of About, so it has an anchor but no navigation entry. */
export const CONNECTIONS_ID = "engineering-connections";

type SectionId = (typeof SCENES)[number]["id"];

/** The navigation is every scene after the hero, numbered from its real position on the page. */
export const NAV_ITEMS = SCENES.slice(1).map((scene, i) => ({
  ...scene,
  index: String(i + 1).padStart(2, "0"),
}));

/** The number a section shows in its heading, the same one the navigation shows. */
export function sectionIndex(id: SectionId): string {
  return NAV_ITEMS.find((item) => item.id === id)?.index ?? "";
}
