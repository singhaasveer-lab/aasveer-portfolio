import Image from "next/image";
import type { GalleryShot } from "@/components/projects/ProjectGallery";
import { LazyComparison, LazyGallery } from "@/components/projects/ProjectMedia";

interface Shot {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

/**
 * What each project shows: a cropped screenshot of the real application where one exists, and the
 * pipeline as named in its source. Screenshots are cropped to the app and show demo data only.
 * StudyForge AI shows its document-flow diagram until public/images/projects/studyforge-ai.webp
 * exists (`ProjectView.has_screenshot`); then it shows that file like the others.
 */
const SHOWCASE: Record<string, { shot?: Shot; flow: string[]; gallery?: GalleryShot[] }> = {
  interviewiq: {
    shot: {
      src: "/images/projects/interviewiq.webp",
      width: 1200,
      height: 683,
      alt: "InterviewIQ dashboard with quick actions for mock interviews, coding practice, voice interviews and resume analysis",
      caption: "Application screenshot, demo account",
    },
    flow: ["Role and skills", "Gemini questions", "Answers", "AI evaluation", "Analytics"],
  },
  "wingman-ai": {
    shot: {
      src: "/images/projects/wingman-ai.webp",
      width: 1200,
      height: 540,
      alt: "Wingman AI's Screenshot Intelligence page, ready for a conversation screenshot upload",
      caption: "Application screenshot",
    },
    flow: ["Screenshot", "OCR", "NLP signals", "TF-IDF retrieval", "Decision brief"],
  },
  "giftbro-ai": {
    shot: {
      src: "/images/projects/giftbro-ai.webp",
      width: 1200,
      height: 546,
      alt: "GiftBro AI results page: a ranked shortlist, with optional Gemini enrichment below it",
      caption: "Application screenshot",
    },
    flow: ["Catalogue", "Filter", "TF-IDF and signals", "Weighted ranking", "Gemini advice"],
  },
  "studyforge-ai": {
    shot: {
      src: "/images/projects/studyforge-ai.webp",
      width: 1200,
      height: 675,
      alt: "StudyForge AI home screen: a box for asking Ashiey a question, with shortcuts to explain a concept, debug code, solve together or plan revision",
      caption: "Application screenshot, demo account",
    },
    flow: ["PDF", "Chunks", "TF-IDF retrieval", "Gemini answer", "Quizzes"],
    gallery: [
      {
        src: "/images/projects/studyforge-ai-planner.webp",
        alt: "StudyForge AI planner listing revision tasks, an assignment and an exam, each with its subject, priority and due date",
        label: "Planner, demo account",
      },
      {
        src: "/images/projects/studyforge-ai-quiz.webp",
        alt: "StudyForge AI practice quiz with multiple-choice questions built from an uploaded PDF",
        label: "Practice quiz, demo account",
      },
    ],
  },
  "smartqueue-ai": {
    shot: {
      src: "/images/projects/smartqueue-ai.webp",
      width: 1200,
      height: 371,
      alt: "SmartQueue AI's queue intelligence view, showing the current congestion status and backlog clearance",
      caption: "Application screenshot, demo queue",
    },
    flow: ["Digital token", "Queue state", "Rule engine", "Staff dispatch", "Counters"],
  },
  pennybloom: {
    shot: {
      src: "/images/projects/pennybloom.webp",
      width: 1200,
      height: 1010,
      alt: "PennyBloom dashboard with income, spending, savings and budget totals, an income versus spending chart and a category breakdown",
      caption: "Application screenshot, demo data",
    },
    flow: ["Transactions", "Budgets", "Recurring rules", "Reports", "JSON files"],
  },
};

/** StudyForge AI's flow: a PDF is cut into page-numbered chunks, and answers cite the pages. */
function StudyDiagram() {
  return (
    <svg
      role="img"
      aria-label="A PDF split into chunks. Retrieval selects the relevant chunks, which produce an answer with page sources and study material."
      viewBox="0 0 560 300"
      className="study-diagram"
    >
      <rect x="26" y="34" width="150" height="214" className="study-sheet back" />
      <rect x="14" y="22" width="150" height="214" className="study-sheet" />
      <text x="28" y="46" className="study-label">
        Uploaded PDF
      </text>
      {[60, 104, 148, 192].map((y, i) => (
        <g key={y}>
          <rect
            x="28"
            y={y}
            width="122"
            height="34"
            className={i === 1 || i === 3 ? "study-chunk hit" : "study-chunk"}
          />
          <text x="36" y={y + 21} className="study-small">
            Chunk, page {i * 2 + 1}
          </text>
        </g>
      ))}

      <path d="M150 121 C 196 121, 196 150, 236 150" className="study-link" />
      <path d="M150 209 C 196 209, 196 150, 236 150" className="study-link" />

      <rect x="236" y="112" width="116" height="76" className="study-core" />
      <text x="294" y="142" textAnchor="middle" className="study-title">
        TF-IDF
      </text>
      <text x="294" y="160" textAnchor="middle" className="study-title">
        retrieval
      </text>
      <text x="294" y="96" textAnchor="middle" className="study-small">
        Student question
      </text>
      <path d="M294 100 V112" className="study-link" />

      <path d="M352 150 C 384 150, 384 86, 414 86" className="study-link" />
      <path d="M352 150 C 384 150, 384 214, 414 214" className="study-link" />

      <rect x="414" y="46" width="132" height="80" className="study-out" />
      <text x="426" y="72" className="study-title">
        Gemini answer
      </text>
      <text x="426" y="94" className="study-small">
        With page sources
      </text>

      <rect x="414" y="174" width="132" height="80" className="study-out" />
      <text x="426" y="200" className="study-title">
        Flashcards
      </text>
      <text x="426" y="218" className="study-title">
        and quizzes
      </text>
    </svg>
  );
}

/** The card's preview: the same screenshot or diagram, without the pipeline. */
export function ProjectPreview({ slug, hasScreenshot }: { slug: string; hasScreenshot: boolean }) {
  const shot = SHOWCASE[slug]?.shot;
  if (shot && hasScreenshot) {
    return (
      <Image
        src={shot.src}
        alt={shot.alt}
        width={shot.width}
        height={shot.height}
        sizes="(min-width: 1024px) 46vw, 92vw"
      />
    );
  }
  return <StudyDiagram />;
}

/** The project's visual: its real interface or document flow, above its labelled pipeline. */
export function ProjectVisual({
  slug,
  name = "",
  hasScreenshot,
  interactive = false,
  className,
}: {
  slug: string;
  name?: string;
  /** False keeps the diagram: the screenshot file is not in public/ yet. */
  hasScreenshot: boolean;
  /** In the case study dialog: adds the comparison slider and any further screens. */
  interactive?: boolean;
  className?: string;
}) {
  const showcase = SHOWCASE[slug];
  return (
    <div className={`case-visual ${className ?? ""}`} data-testid="project-visual">
      {showcase && (
        <div className="case-stage">
          {showcase.shot && hasScreenshot ? (
            <figure className="case-shot">
              {interactive ? (
                <LazyComparison
                  slug={slug}
                  name={name}
                  src={showcase.shot.src}
                  alt={showcase.shot.alt}
                />
              ) : (
                <Image
                  src={showcase.shot.src}
                  alt={showcase.shot.alt}
                  width={showcase.shot.width}
                  height={showcase.shot.height}
                  sizes="(min-width: 1024px) 46vw, 92vw"
                />
              )}
              <figcaption>{showcase.shot.caption}</figcaption>
            </figure>
          ) : (
            <StudyDiagram />
          )}
          <ol className="case-flow" aria-label="Pipeline" data-testid="project-flow">
            {showcase.flow.map((stage) => (
              <li key={stage}>{stage}</li>
            ))}
          </ol>
          {interactive && showcase.gallery && hasScreenshot && (
            <LazyGallery name={name} shots={showcase.gallery} />
          )}
        </div>
      )}
    </div>
  );
}
