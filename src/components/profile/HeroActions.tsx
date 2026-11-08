"use client";

import { Fragment } from "react";
import { Magnetic } from "@/components/motion-primitives/magnetic";
import { DownloadIcon, GitHubIcon, LinkedInIcon } from "@/components/ui/Icons";
import { useFinePointer } from "@/hooks/useFinePointer";
import type { Links } from "@/lib/validation/schemas";

/**
 * The hero actions: the resume download first, then the GitHub and LinkedIn profiles. On
 * hover-capable fine pointers they lean towards the approaching pointer, and a highlight follows it
 * inside the button. The highlight is set directly on the element, not through state.
 */
function followPointer(event: React.PointerEvent<HTMLAnchorElement>) {
  const { left, top } = event.currentTarget.getBoundingClientRect();
  event.currentTarget.style.setProperty("--bx", `${event.clientX - left}px`);
  event.currentTarget.style.setProperty("--by", `${event.clientY - top}px`);
}

type HeroLinks = Pick<Links, "resume_href" | "github_url" | "linkedin_url">;

export function HeroActions({ links }: { links: HeroLinks }) {
  const fine = useFinePointer();
  // Always wrapped, with no pull until a fine pointer is detected: swapping the wrapper in after
  // hydration would replace the links, dropping focus from any link a visitor had reached.
  const wrap = (node: React.ReactNode) => (
    <Magnetic
      intensity={fine ? 0.14 : 0}
      range={170}
      actionArea="global"
      springOptions={{ stiffness: 140, damping: 19, mass: 0.5 }}
    >
      {node}
    </Magnetic>
  );

  const profiles = [
    { href: links.github_url, label: "GitHub", icon: <GitHubIcon className="size-4" /> },
    { href: links.linkedin_url, label: "LinkedIn", icon: <LinkedInIcon className="size-4" /> },
  ];

  return (
    <div className="hero-actions" data-testid="hero-actions">
      {links.resume_href &&
        wrap(
          <a
            href={links.resume_href}
            download
            className="btn btn-primary btn-caps btn-magnet hero-resume w-full sm:w-auto"
            onPointerMove={followPointer}
          >
            <DownloadIcon />
            Download resume<span className="sr-only"> (PDF)</span>
          </a>,
        )}
      {profiles.map((profile) => (
        <Fragment key={profile.label}>
          {wrap(
            <a
              href={profile.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-caps btn-magnet hero-profile w-full sm:w-auto"
              onPointerMove={followPointer}
            >
              {profile.icon}
              {profile.label}
              <span className="sr-only"> profile (opens in a new tab)</span>
            </a>,
          )}
        </Fragment>
      ))}
    </div>
  );
}
