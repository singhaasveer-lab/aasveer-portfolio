"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useExplorer } from "@/components/explorer/ExplorerProvider";
import { Overlay } from "@/components/explorer/Overlay";
import { ToolbarExpandable } from "@/components/motion-primitives/toolbar-expandable";
import { CloseIcon, CommandIcon } from "@/components/ui/Icons";
import { buildCommands, filterCommands, type CommandAction } from "@/lib/explorer/commands";
import type { LabModule } from "@/lib/explorer/schema";
import { goToSection } from "@/lib/navigation";
import { SECTION_IDS } from "@/lib/sections";
import type { Links } from "@/lib/validation/schemas";

function followLink(href: string, attributes: Partial<HTMLAnchorElement> = {}) {
  const link = document.createElement("a");
  link.href = href;
  Object.assign(link, attributes);
  link.click();
}

const QUICK_LINKS = [
  { id: SECTION_IDS.evidence, label: "Evidence" },
  { id: SECTION_IDS.projects, label: "Projects" },
  { id: SECTION_IDS.lab, label: "AI Lab" },
  { id: SECTION_IDS.contact, label: "Contact" },
];

/**
 * The launcher: a compact pill in the sticky header that expands into quick links and the Command
 * Centre. It sits in the header's own row, so at rest it can never cover the page: a button
 * floating over scrolling content always passes over some of it. Phones and tablets get a round
 * icon, and wide screens add the label. The panel opens only when asked, and Escape closes it.
 */
export function NexusLauncher({ resumeHref }: { resumeHref: string | null }) {
  const { setCommandOpen } = useExplorer();
  return (
    <ToolbarExpandable
      className="nexus-toolbar"
      triggerClassName="nexus-launcher"
      panelClassName="nexus-quick"
      label="NEXUS / EXPLORE: quick links"
      testId="nexus-launcher"
      trigger={
        <>
          <CommandIcon />
          <span className="nexus-launcher-text">NEXUS / EXPLORE</span>
        </>
      }
    >
      <ul data-testid="nexus-quick">
        {QUICK_LINKS.map((link) => (
          <li key={link.id}>
            <a href={`#${link.id}`}>{link.label}</a>
          </li>
        ))}
        {resumeHref && (
          <li>
            <a href={resumeHref} download>
              Download Resume
            </a>
          </li>
        )}
        <li>
          <button type="button" data-testid="nexus-open" onClick={() => setCommandOpen(true)}>
            Command Centre
          </button>
        </li>
      </ul>
    </ToolbarExpandable>
  );
}

/**
 * The NEXUS Command Centre: a searchable list of everything on the page. The search box is an ARIA
 * combobox: focus stays in the input while the arrow keys move the active option. Ctrl/Cmd+K is a
 * shortcut only; the launcher is always there.
 */
export function CommandCentre({ modules, links }: { modules: LabModule[]; links: Links }) {
  const {
    projects,
    setLabModule,
    openArchitecture,
    commandOpen: open,
    setCommandOpen: setOpen,
  } = useExplorer();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  /** Runs after the overlay has closed, once focus has returned and the page can scroll. */
  const pending = useRef<CommandAction | null>(null);

  const commands = useMemo(
    () => buildCommands({ modules, projects, links }),
    [modules, projects, links],
  );
  const results = useMemo(() => filterCommands(commands, query), [commands, query]);
  const active = results[Math.min(cursor, results.length - 1)];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  // A keyboard user starts in the search box. On touch screens that would raise the on-screen
  // keyboard over the commands, so focus goes to the title and the box is one tap away.
  useEffect(() => {
    if (!open) return;
    const touch = window.matchMedia("(pointer: coarse)").matches;
    (touch ? title.current : input.current)?.focus();
  }, [open]);

  useEffect(() => {
    if (!active) return;
    document.getElementById(`command-${active.id}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function run(action: CommandAction) {
    pending.current = action;
    setOpen(false);
  }

  function afterClose() {
    setQuery("");
    setCursor(0);
    const action = pending.current;
    pending.current = null;
    if (!action) return;
    switch (action.type) {
      case "section":
        goToSection(action.id);
        break;
      case "lab":
        setLabModule(action.module);
        goToSection(SECTION_IDS.lab);
        break;
      case "architecture":
        openArchitecture(action.slug);
        break;
      case "download":
        followLink(action.href, { download: "" });
        break;
      case "external":
        followLink(action.href, { target: "_blank", rel: "noopener noreferrer" });
        break;
    }
  }

  function onInputKeyDown(event: React.KeyboardEvent) {
    const count = results.length;
    if (event.key === "ArrowDown" && count > 0) {
      event.preventDefault();
      setCursor((Math.min(cursor, count - 1) + 1) % count);
    } else if (event.key === "ArrowUp" && count > 0) {
      event.preventDefault();
      setCursor((Math.min(cursor, count - 1) - 1 + count) % count);
    } else if (event.key === "Enter" && active) {
      event.preventDefault();
      run(active.action);
    }
  }

  return (
    <>
      <Overlay
        open={open}
        onClose={() => setOpen(false)}
        onClosed={afterClose}
        labelledBy="nexus-title"
        panelClassName="nexus-panel"
        testId="nexus-dialog"
      >
        <header className="nexus-head">
          <div>
            <p className="nexus-mark">NEXUS // AASVEER</p>
            <h2 id="nexus-title" ref={title} tabIndex={-1} className="nexus-title">
              NEXUS Command Centre
            </h2>
          </div>
          <button
            type="button"
            className="overlay-close"
            aria-label="Close NEXUS Command Centre"
            data-testid="nexus-close"
            onClick={() => setOpen(false)}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="nexus-search">
          <span className="nexus-prompt" aria-hidden="true">
            &gt;
          </span>
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label="Search commands"
            aria-expanded={results.length > 0}
            aria-controls="nexus-results"
            aria-activedescendant={active ? `command-${active.id}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search sections, systems and projects"
            value={query}
            data-testid="nexus-input"
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            onKeyDown={onInputKeyDown}
          />
        </div>

        <ul
          ref={list}
          id="nexus-results"
          role="listbox"
          aria-label="Commands"
          className="nexus-list"
        >
          {results.map((command, i) => (
            <li
              key={command.id}
              id={`command-${command.id}`}
              role="option"
              aria-selected={command.id === active?.id}
              className="nexus-option"
              data-group-start={results[i - 1]?.group !== command.group || undefined}
              data-group={command.group}
              data-testid="nexus-option"
              onPointerMove={() => setCursor(i)}
              onClick={() => run(command.action)}
            >
              <span className="nexus-option-label">{command.label}</span>
              <span className="nexus-option-hint">{command.hint}</span>
            </li>
          ))}
        </ul>
        {results.length === 0 && (
          <p className="nexus-empty" data-testid="nexus-empty">
            No commands match that search.
          </p>
        )}
        <p className="sr-only" role="status">
          {results.length} commands available
        </p>
        <footer className="nexus-foot" aria-hidden="true">
          <span>↑ ↓ move</span>
          <span>Enter run</span>
          <span>Esc close</span>
        </footer>
      </Overlay>
    </>
  );
}
