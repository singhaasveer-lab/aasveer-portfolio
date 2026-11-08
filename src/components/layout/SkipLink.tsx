export const MAIN_CONTENT_ID = "main-content";

/** First focusable element on the page. Hidden until focused. */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only-focusable btn btn-primary fixed top-3 left-3 z-[60]"
    >
      Skip to main content
    </a>
  );
}
