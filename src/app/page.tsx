import type { Metadata } from "next";
import { Certifications } from "@/components/certifications/Certifications";
import { AboutSection } from "@/components/about/AboutSection";
import { ContactSection } from "@/components/contact/ContactSection";
import { ArchitectureDialog } from "@/components/explorer/architecture/ArchitectureDialog";
import { Casebook } from "@/components/casebook/Casebook";
import { EvidenceEngine } from "@/components/evidence/EvidenceEngine";
import { CommandCentre } from "@/components/explorer/command/CommandCentre";
import { ExplorerProvider } from "@/components/explorer/ExplorerProvider";
import { AiLab } from "@/components/explorer/lab/AiLab";
import { CapabilityNetwork, WORKFLOWS_ID } from "@/components/explorer/lab/CapabilityNetwork";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CaseCursor } from "@/components/motion/CaseCursor";
import { Scene, SceneItem } from "@/components/motion/Scene";
import { SceneBackdrop } from "@/components/motion/SceneBackdrop";
import { SceneRail } from "@/components/motion/SceneRail";
import { SignalTrace } from "@/components/motion/SignalTrace";
import { StatStrip } from "@/components/motion/StatStrip";
import { MAIN_CONTENT_ID } from "@/components/layout/SkipLink";
import { EducationBlock } from "@/components/profile/EducationBlock";
import { IntroSection } from "@/components/profile/IntroSection";
import { SkillGroups } from "@/components/profile/SkillGroups";
import { ProjectsSection } from "@/components/projects/ProjectsSection";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { loadPortfolio } from "@/lib/data/loadPortfolio";
import { SECTION_IDS, sectionIndex } from "@/lib/sections";
import { LINK_PREVIEW, linkPreviewAlt, parseSiteUrl } from "@/lib/site";

export function generateMetadata(): Metadata {
  const { profile } = loadPortfolio();
  const title = `${profile.full_name} | AI/ML Engineer Portfolio`;
  // Canonical URL and link preview image need the real public address; without it, they are left out.
  const site = parseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const image = {
    url: LINK_PREVIEW.path,
    width: LINK_PREVIEW.width,
    height: LINK_PREVIEW.height,
    alt: linkPreviewAlt(profile),
    type: "image/png",
  };
  return {
    title,
    description: profile.headline,
    ...(site ? { alternates: { canonical: "/" } } : {}),
    openGraph: {
      title,
      description: profile.headline,
      type: "profile",
      ...(site ? { url: "/", images: [image] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: profile.headline,
      ...(site ? { images: [image] } : {}),
    },
  };
}

export default function HomePage() {
  // Build-time data. Page components never fetch /api/*.json in the browser.
  const { profile, links, skillGroups, certifications, projects, explorer, preview } =
    loadPortfolio();

  // Which projects use each skill, by its name on the resume, from the verified skill map.
  const skillUses = Object.fromEntries(
    explorer.skillMap.skills.map((skill) => [
      skill.skill,
      explorer.skillMap.edges
        .filter((edge) => edge.skill === skill.id)
        .map((edge) => projects.find((p) => p.slug === edge.project)!.display_name),
    ]),
  );

  return (
    <ExplorerProvider projects={projects} architectures={explorer.architectures}>
      <SceneBackdrop />
      <SiteHeader name={profile.full_name} resumeHref={links.resume_href} />
      <SceneRail />

      {preview && (
        <div
          role="note"
          className="border-b border-violet/40 bg-violet/10 px-4 py-2 text-center font-mono text-xs text-violet"
        >
          DEVELOPMENT PREVIEW: all project entries from content/projects.json are shown. Unapproved
          role statements and unverified links are withheld. This never appears in a production
          build.
        </div>
      )}

      <main id={MAIN_CONTENT_ID} tabIndex={-1}>
        <IntroSection
          profile={profile}
          portrait={explorer.about.portrait}
          roleLoop={explorer.about.role_loop}
        />

        <StatStrip
          stats={[
            { label: "Projects", value: projects.length },
            { label: "Certifications", value: certifications.length },
            { label: "Verified skill links", value: explorer.skillMap.edges.length },
          ]}
        />

        <AboutSection
          profile={profile}
          about={explorer.about}
          connections={explorer.skillMap}
          projectNames={Object.fromEntries(projects.map((p) => [p.slug, p.display_name]))}
        />

        <section id={SECTION_IDS.evidence} aria-labelledby="evidence-heading">
          <Scene variant="unfold" className="section">
            <div className="container-page">
              <SceneItem order={0} from="mask">
                <SectionHeading
                  id="evidence-heading"
                  index={sectionIndex(SECTION_IDS.evidence)}
                  kicker="The evidence engine // inspect the source"
                  title="Don't take my word for it."
                />
              </SceneItem>
              <SceneItem order={1}>
                <p className="ev-lede">
                  Every technical claim should have something behind it. Explore the projects,
                  implementations and engineering evidence that demonstrate how I turn technical
                  knowledge into working systems.
                </p>
                <EvidenceEngine evidence={explorer.evidence} />
              </SceneItem>
            </div>
          </Scene>
        </section>

        <section id={SECTION_IDS.projects} aria-labelledby="projects-heading">
          <Scene variant="stage" className="section bg-[var(--ink-raised)]">
            <div className="container-page">
              <SceneItem order={0} from="mask">
                <SectionHeading
                  id="projects-heading"
                  index={sectionIndex(SECTION_IDS.projects)}
                  kicker="Projects / case files"
                  title="Featured projects"
                  meta={projects.length > 0 ? `${projects.length} case files` : undefined}
                />
              </SceneItem>
              <ProjectsSection projects={projects} preview={preview} />
            </div>
          </Scene>
        </section>

        <section id={SECTION_IDS.skills} aria-labelledby="skills-heading">
          <Scene variant="lattice" className="section">
            <SignalTrace
              shape="lattice"
              className="top-[calc(clamp(88px,12vw,160px)+64px)] right-[calc(var(--gutter)+2rem)] h-[170px] w-[min(30vw,380px)]"
            />
            <div className="container-page relative">
              <SceneItem order={0} from="mask">
                <SectionHeading
                  id="skills-heading"
                  index={sectionIndex(SECTION_IDS.skills)}
                  kicker="Skills / field guide"
                  title="Technical skills"
                  meta={`${skillGroups.length} categories`}
                />
              </SceneItem>
              <SkillGroups groups={skillGroups} uses={skillUses} />
            </div>
          </Scene>
        </section>

        <section id={SECTION_IDS.casebook} aria-labelledby="casebook-heading">
          <Scene variant="unfold" className="section bg-[var(--ink-raised)]">
            <div className="container-page">
              <SceneItem order={0} from="mask">
                <SectionHeading
                  id="casebook-heading"
                  index={sectionIndex(SECTION_IDS.casebook)}
                  kicker="Engineering casebook // Behind the build"
                  title="Behind the build."
                  meta={`${explorer.casebook.length} case files`}
                />
              </SceneItem>
              <SceneItem order={1}>
                <p className="cb-lede">
                  Every system has an engineering story. Explore the challenges, investigations and
                  technical decisions behind the systems I build.
                </p>
                <Casebook cases={explorer.casebook} />
              </SceneItem>
            </div>
          </Scene>
        </section>

        <section id={SECTION_IDS.lab} aria-labelledby="ai-lab-heading">
          <Scene variant="lab" className="section">
            <div className="container-page">
              <SceneItem order={0} from="mask">
                <SectionHeading
                  id="ai-lab-heading"
                  index={sectionIndex(SECTION_IDS.lab)}
                  kicker="Laboratory / how the systems work"
                  title="The AI Systems Laboratory"
                  meta={`${explorer.lab.length} systems`}
                />
              </SceneItem>
              <SceneItem order={1}>
                <div className="lab-part" id="lab-capabilities">
                  <p className="lab-part-kicker">
                    <span aria-hidden="true">01</span> Capability map
                  </p>
                  <h3 className="lab-part-title display">Where each capability is built.</h3>
                  <p className="lab-part-lede">
                    Select a capability to see the projects that use it, or a project to see what it
                    is built from. Every line is checked against that project&apos;s source.
                  </p>
                  <CapabilityNetwork
                    capabilities={explorer.capabilities}
                    moduleNames={Object.fromEntries(explorer.lab.map((m) => [m.id, m.label]))}
                  />
                </div>
                <div className="lab-part" id={WORKFLOWS_ID} tabIndex={-1}>
                  <p className="lab-part-kicker">
                    <span aria-hidden="true">02</span> System workflows
                  </p>
                  <p className="lab-part-lede">
                    Open a system and follow its pipeline stage by stage. Every stage is taken from
                    the project&apos;s own code, including the stages a project does not have.
                  </p>
                  <AiLab modules={explorer.lab} />
                </div>
              </SceneItem>
            </div>
          </Scene>
        </section>

        <section id={SECTION_IDS.education} aria-labelledby="education-heading">
          <Scene variant="turn" className="section bg-[var(--ink-raised)]">
            <div className="container-page">
              <SceneItem order={0} from="mask">
                <SectionHeading
                  id="education-heading"
                  index={sectionIndex(SECTION_IDS.education)}
                  kicker="Academic record // Education"
                  title="Education"
                />
              </SceneItem>
              <SceneItem order={1}>
                <EducationBlock
                  education={profile.education}
                  earlier={explorer.about.earlier_education}
                />
              </SceneItem>
              <SceneItem order={2} className="mt-20 md:mt-28">
                <Certifications certifications={certifications} />
              </SceneItem>
            </div>
          </Scene>
        </section>

        <section
          id={SECTION_IDS.contact}
          className="overflow-hidden"
          aria-labelledby="contact-heading"
        >
          <Scene variant="finale" className="section">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_80%_100%,rgb(98_210_191/0.1),transparent_70%),radial-gradient(40%_40%_at_0%_100%,rgb(232_164_103/0.06),transparent_70%)]"
            />
            <SignalTrace
              shape="converge"
              className="top-[calc(clamp(88px,12vw,160px)+56px)] right-[calc(var(--gutter)+2rem)] h-[150px] w-[min(30vw,380px)]"
            />
            <div className="container-page relative">
              <SceneItem order={0} from="mask">
                <SectionHeading
                  id="contact-heading"
                  index={sectionIndex(SECTION_IDS.contact)}
                  kicker="Open channel // Establish connection"
                  title="Let's start a conversation."
                />
              </SceneItem>
              <ContactSection links={links} />
            </div>
          </Scene>
        </section>
      </main>

      <SiteFooter name={profile.full_name} links={links} />
      <CommandCentre modules={explorer.lab} links={links} />
      <CaseCursor />
      <ArchitectureDialog />
    </ExplorerProvider>
  );
}
