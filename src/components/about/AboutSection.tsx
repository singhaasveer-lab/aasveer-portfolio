import { AboutSpine } from "@/components/about/AboutSpine";
import { BuildProcess } from "@/components/about/BuildProcess";
import { EngineeringConnections } from "@/components/about/EngineeringConnections";
import { EngineeringPerspective } from "@/components/about/EngineeringPerspective";
import { EngineeringPrinciples } from "@/components/about/EngineeringPrinciples";
import { ScrambleOnce, Stagger } from "@/components/motion/Accents";
import { Scene } from "@/components/motion/Scene";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import type { About, SkillMap } from "@/lib/explorer/schema";
import { SECTION_IDS, sectionIndex } from "@/lib/sections";
import type { Profile } from "@/lib/validation/schemas";

/** One line of the statement, with its accent phrases picked out. */
function HeadlineLine({ line, accents }: { line: string; accents: string[] }) {
  const pattern = new RegExp(`(${accents.join("|")})`);
  return line
    .split(pattern)
    .map((part, i) =>
      accents.includes(part) ? <em key={i}>{part}</em> : <span key={i}>{part}</span>,
    );
}

function Chapter({ mark, title }: { mark: string; title: string }) {
  return (
    <h3 className="ab-chapter">
      <span aria-hidden="true">{mark}</span>
      {title}
    </h3>
  );
}

/**
 * The engineer behind the systems: a personal profile told as one continuous page, not a panel of
 * cards. It opens with a statement and who is making it, then how they see a problem, what they
 * hold to and how they build, closing on where the skills are applied. Facts come from content/profile.json and
 * content/about.json. Every interactive part keeps its content available without JavaScript.
 */
export function AboutSection({
  profile,
  about,
  connections,
  projectNames,
}: {
  profile: Profile;
  about: About;
  connections: SkillMap;
  projectNames: Record<string, string>;
}) {
  const { degree, institution, period } = profile.education;
  return (
    <section id={SECTION_IDS.about} aria-labelledby="about-heading" className="about">
      <Scene variant="unfold" className="section">
        <AboutSpine />
        <div className="container-page relative">
          <div className="ab-opening">
            <p className="ab-kicker">
              <span className="text-accent" aria-hidden="true">
                {sectionIndex(SECTION_IDS.about)}
              </span>
              <span className="sr-only">{about.eyebrow}</span>
              <span aria-hidden="true">
                <ScrambleOnce>{about.eyebrow}</ScrambleOnce>
              </span>
            </p>

            <h2
              id="about-heading"
              data-section-heading
              tabIndex={-1}
              className="section-heading display ab-statement"
            >
              <Stagger as="span" item="span" rise={22} className="ab-statement-lines">
                {about.headline.map((line) => (
                  <span key={line} className="ab-statement-line">
                    <HeadlineLine line={line} accents={about.headline_accent} />{" "}
                  </span>
                ))}
              </Stagger>
            </h2>

            <ScrollReveal preset="rise" className="ab-person">
              <div className="ab-who">
                <p className="ab-name">{profile.full_name}</p>
                <p className="ab-role">{profile.role}</p>
                <dl className="ab-dossier" data-testid="about-dossier">
                  <div>
                    <dt>Education</dt>
                    <dd>
                      {degree}
                      <br />
                      {institution}, {period}
                    </dd>
                  </div>
                  <div>
                    <dt>Based in</dt>
                    <dd>{profile.location}</dd>
                  </div>
                </dl>
              </div>
              <div className="ab-voice">
                <p className="ab-intro">{about.intro}</p>
                <div className="ab-interests">
                  <p className="label">Drawn to</p>
                  <ul data-testid="about-interests">
                    {about.interests.map((interest) => (
                      <li key={interest}>{interest}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal preset="rise" className="ab-chapter-block">
            <Chapter mark="A" title="Engineering perspective" />
            <EngineeringPerspective perspective={about.perspective} />
          </ScrollReveal>

          <ScrollReveal preset="rise" className="ab-chapter-block">
            <Chapter mark="B" title="Engineering philosophy" />
            <EngineeringPrinciples principles={about.principles} />
          </ScrollReveal>

          <ScrollReveal preset="rise" className="ab-chapter-block">
            <Chapter mark="C" title="How I build" />
            <BuildProcess process={about.process} />
          </ScrollReveal>

          <ScrollReveal preset="rise">
            <EngineeringConnections map={connections} projectNames={projectNames} />
          </ScrollReveal>
        </div>
      </Scene>
    </section>
  );
}
