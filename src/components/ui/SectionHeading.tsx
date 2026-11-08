import { ScrambleOnce } from "@/components/motion/Accents";
import { RevealText } from "@/components/motion/RevealText";
import { SectionRule } from "@/components/ui/SectionRule";

interface SectionHeadingProps {
  id: string;
  index: string;
  kicker: string;
  title: string;
  /** Optional right-hand metadata line, such as an item count taken from the data. */
  meta?: React.ReactNode;
}

/**
 * Section opener: a signal rule, a numbered mono kicker (the numbers record the real section
 * order) and a large display heading. The h2 is the focus target for in-page navigation.
 */
export function SectionHeading({ id, index, kicker, title, meta }: SectionHeadingProps) {
  return (
    <header className="mb-12 md:mb-20">
      <SectionRule />
      <span aria-hidden="true" className="section-ticks" />
      <div className="mt-5 flex items-baseline justify-between gap-6 font-mono text-[0.7rem] tracking-[0.2em] uppercase">
        <p className="flex items-baseline gap-4" aria-hidden="true">
          <span className="text-accent">{index}</span>
          <ScrambleOnce className="text-muted">{kicker}</ScrambleOnce>
        </p>
        {meta && <p className="text-faint">{meta}</p>}
      </div>
      <h2
        id={id}
        data-section-heading
        tabIndex={-1}
        className="section-heading display mt-6 max-w-[16ch] text-[clamp(2.6rem,7vw,5.6rem)]"
      >
        <RevealText>{title}</RevealText>
      </h2>
    </header>
  );
}
