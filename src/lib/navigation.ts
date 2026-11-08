function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Moves focus to the target of an in-page link: a section's heading when the target is a
 * section, otherwise the target itself. Focus never scrolls; scrolling is handled separately.
 */
function focusFragmentTarget(target: HTMLElement) {
  const heading =
    target.tagName === "SECTION"
      ? target.querySelector<HTMLElement>("[data-section-heading]")
      : null;
  const focusable = heading ?? target;
  if (!focusable.hasAttribute("tabindex")) focusable.setAttribute("tabindex", "-1");
  focusable.focus({ preventScroll: true });
}

/** Updates the URL, scrolls smoothly (instantly under reduced motion) and moves focus. */
export function goToElement(id: string, target: HTMLElement) {
  if (window.location.hash !== `#${id}`) window.history.pushState(null, "", `#${id}`);
  target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  focusFragmentTarget(target);
}

export function goToSection(id: string) {
  const target = document.getElementById(id);
  if (target) goToElement(id, target);
}
