"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { NexusLauncher } from "@/components/explorer/command/CommandCentre";
import { HeaderBlur } from "@/components/layout/HeaderBlur";
import { NavRoll } from "@/components/motion/Accents";
import { AnimatedBackground } from "@/components/motion-primitives/animated-background";
import { ScrollProgress } from "@/components/motion-primitives/scroll-progress";
import { useActiveSection } from "@/hooks/useActiveSection";
import { goToElement } from "@/lib/navigation";
import { NAV_ITEMS, SECTION_IDS } from "@/lib/sections";

const DESKTOP_QUERY = "(min-width: 768px)";
const NO_ACTIVE = "__none";

const NAV_IDS = NAV_ITEMS.map((item) => item.id);

export function SiteHeader({ name, resumeHref }: { name: string; resumeHref: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const active = useActiveSection(NAV_IDS);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // In-page links: smooth scroll on click (instant under reduced motion), then focus the heading.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const id = decodeURIComponent(link.getAttribute("href")!.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      event.preventDefault();
      goToElement(id, target);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Direct loads of /#section and back/forward navigation: the hash wins. The browser's own
  // scroll restoration is switched off for hash loads (on a reload it would otherwise put the
  // reader back where they were, under a URL that names another section), and the target is
  // aligned now, once fonts settle and once the page has loaded, unless the visitor has
  // already started scrolling.
  useEffect(() => {
    let touched = false;
    const markTouched = () => {
      touched = true;
    };
    function alignToHash() {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
    }
    const alignOnLoad = () => {
      if (!touched) alignToHash();
    };
    if (window.location.hash) {
      if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
      alignOnLoad();
      void document.fonts.ready.then(alignOnLoad);
      if (document.readyState !== "complete") {
        window.addEventListener("load", () => requestAnimationFrame(alignOnLoad), { once: true });
      }
    }
    const input = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const type of input) window.addEventListener(type, markTouched, { passive: true });
    window.addEventListener("hashchange", alignToHash);
    return () => {
      for (const type of input) window.removeEventListener(type, markTouched);
      window.removeEventListener("hashchange", alignToHash);
    };
  }, []);

  // Escape closes the panel and returns focus to the menu button.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // The panel closes when the viewport widens to the desktop breakpoint.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <header className="site-header">
      <div className="container-page flex h-[var(--header-h)] items-center gap-2 sm:gap-3">
        <a
          href={`#${SECTION_IDS.intro}`}
          className="mr-auto inline-flex min-h-11 items-center gap-3 rounded-sm font-mono text-[0.78rem] tracking-[0.2em] whitespace-nowrap uppercase no-underline max-[359px]:gap-2 max-[359px]:tracking-[0.12em]"
        >
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-accent shadow-[0_0_12px_var(--accent)]"
          />
          <span aria-hidden="true" className="hidden text-accent xl:inline">
            NEXUS {"//"}
          </span>
          {name}
        </a>

        <nav aria-label="Primary" className="ml-auto hidden md:block">
          <ul className="nav-rail">
            <AnimatedBackground
              defaultValue={active ?? NO_ACTIVE}
              className="nav-indicator"
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            >
              {NAV_ITEMS.map((item) => (
                <li key={item.id} data-id={item.id}>
                  <a
                    className="nav-link"
                    href={`#${item.id}`}
                    aria-current={active === item.id ? "location" : undefined}
                  >
                    <span className="nav-index" aria-hidden="true">
                      {item.index}
                    </span>
                    <NavRoll label={item.label} />
                  </a>
                </li>
              ))}
            </AnimatedBackground>
          </ul>
        </nav>

        <NexusLauncher resumeHref={resumeHref} />

        <button
          ref={buttonRef}
          type="button"
          className="btn btn-ghost min-h-11 min-w-11 px-3 text-sm min-[360px]:px-4 md:hidden"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <span
            aria-hidden="true"
            className="flex w-4 flex-col gap-[3px] [&>span]:h-px [&>span]:bg-current"
          >
            <span />
            <span />
            <span />
          </span>
          <span className="max-[359px]:sr-only">Menu</span>
        </button>
      </div>

      <HeaderBlur />

      <div aria-hidden="true" className="absolute inset-x-0 bottom-[-1px] h-px">
        <ScrollProgress className="h-px bg-gradient-to-r from-accent via-blue to-violet" />
      </div>

      <nav
        id={panelId}
        aria-label="Primary (mobile)"
        className="mobile-panel md:hidden"
        hidden={!open}
      >
        <ul>
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <a href={`#${item.id}`} onClick={() => close(false)}>
                <span className="nav-index" aria-hidden="true">
                  {item.index}
                </span>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
