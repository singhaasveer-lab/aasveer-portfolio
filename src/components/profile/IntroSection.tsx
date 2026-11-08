import { HeroLoop } from "@/components/hero/HeroLoop";
import { HeroLayer, HeroLight, HeroMotion } from "@/components/hero/HeroMotion";
import { HeroPortrait } from "@/components/hero/HeroPortrait";
import { NeuralField } from "@/components/hero/NeuralField";
import { Scene } from "@/components/motion/Scene";
import { Parallax } from "@/components/motion/SceneBackdrop";
import { HeroActions } from "@/components/profile/HeroActions";
import type { About } from "@/lib/explorer/schema";
import { SECTION_IDS } from "@/lib/sections";
import type { Profile } from "@/lib/validation/schemas";

/** The entrance order, in milliseconds: label, name, role, description, focus, actions. */
const T = { label: 0, name: 140, role: 640, intro: 820, focus: 960, actions: 1300, portrait: 260 };

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as React.CSSProperties;

/** One word, its letters rising out of a mask one after another. */
function Letters({ word, start }: { word: string; start: number }) {
  return [...word].map((letter, i) => (
    <span key={i} className="hero-letter" style={delay(start + i * 34)}>
      {letter}
    </span>
  ));
}

/**
 * The name on two lines. The first word rises letter by letter. The last rises whole, because its
 * gradient is painted through the element's own text and would not reach letters in child spans.
 */
function Name({ name }: { name: string }) {
  const words = name.trim().split(/\s+/);
  const last = words.pop()!;
  const first = words.join(" ");
  return (
    <>
      {first && (
        <span className="name-line">
          <Letters word={first} start={T.name} />
        </span>
      )}{" "}
      <span className="name-line pl-[0.32em]">
        <em className="hero-letter name-accent italic" style={delay(T.name + 260)}>
          {last}
        </em>
      </span>
    </>
  );
}

function PinIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-3.5" fill="none">
      <path
        d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/**
 * Opening scene. Left: identity, role, introduction, focus areas, location and the two primary
 * actions. Right: the portrait. Behind them a neural field, a grid and a travelling light respond
 * to the pointer, each plane by a different amount (see HeroMotion). Every line of text comes from
 * content/profile.json. Phones keep the name beside the portrait and drop the pointer effects.
 */
export function IntroSection({
  profile,
  portrait,
  roleLoop,
}: {
  profile: Profile;
  portrait: About["portrait"];
  roleLoop: string[];
}) {
  return (
    <HeroMotion id={SECTION_IDS.intro} labelledBy="intro-heading">
      {/* Depth: the glow and the grid drift slower than the content as the page scrolls. */}
      <Parallax speed={0.45} className="hero-backdrop" />
      <HeroLayer depth={-7} className="hero-depth">
        <Parallax speed={0.25} className="hero-grid" />
      </HeroLayer>
      <NeuralField />
      <HeroLight />
      <div className="hero-scan" aria-hidden="true" />

      <Scene variant="hero">
        <div className="container-page hero-layout relative">
          <HeroLayer depth={4} className="hero-title relative z-10">
            <p className="hero-wipe hero-label" style={delay(T.label)}>
              <span className="text-accent">NEXUS</span>{" "}
              <span aria-hidden="true" className="text-faint">
                {"//"}
              </span>{" "}
              {profile.status_label}
            </p>

            <h1
              id="intro-heading"
              data-section-heading
              tabIndex={-1}
              aria-label={profile.full_name}
              className="display hero-name mt-3"
            >
              <Name name={profile.full_name} />
            </h1>
          </HeroLayer>

          <div className="hero-reveal hero-figure relative" style={delay(T.portrait)}>
            <HeroPortrait portrait={portrait} role={profile.role} location={profile.location} />
          </div>

          <HeroLayer depth={2.5} className="hero-body relative z-10">
            <p className="hero-track hero-role" style={delay(T.role)}>
              <span aria-hidden="true" className="hero-role-rule" style={delay(T.role)} />
              {profile.role}
            </p>
            <div className="hero-in" style={delay(T.role + 120)}>
              <HeroLoop phrases={roleLoop} />
            </div>

            <p className="hero-in hero-intro mt-3" style={delay(T.intro)}>
              {profile.intro}
            </p>

            <div className="mt-5">
              <p className="hero-in label" id="focus-label" style={delay(T.focus)}>
                Focus
              </p>
              <ul className="mt-3 flex flex-wrap gap-2" aria-labelledby="focus-label">
                {profile.focus_areas.map((area, i) => (
                  <li key={area} className="hero-chip chip" style={delay(T.focus + i * 55)}>
                    {area}
                  </li>
                ))}
              </ul>
              <p
                className="hero-in mt-5 flex items-center gap-2 font-mono text-[0.78rem] text-muted"
                style={delay(T.actions - 100)}
              >
                <PinIcon />
                {profile.location}
              </p>
            </div>

            <div className="hero-rise mt-5 sm:mt-6" style={delay(T.actions)}>
              <HeroActions links={profile.links} />
            </div>
          </HeroLayer>
        </div>
      </Scene>
    </HeroMotion>
  );
}
