import { ExternalLink } from "@/components/ui/ExternalLink";
import { SECTION_IDS } from "@/lib/sections";
import type { Links } from "@/lib/validation/schemas";

interface SiteFooterProps {
  name: string;
  /** The same links object that page.tsx passes to ContactSection. */
  links: Links;
}

const footerLink = "nav-link px-2 text-sm";

/** Repeats the contact links so they are one activation away from every section. */
export function SiteFooter({ name, links }: SiteFooterProps) {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-[var(--ink-deep)]">
      <div className="container-page flex flex-col gap-6 pt-10 pb-24 md:flex-row md:items-center md:justify-between md:pb-20">
        <p className="display text-2xl italic">{name}</p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid="footer-links">
            <li>
              <a className={footerLink} href={`#${SECTION_IDS.contact}`}>
                Contact
              </a>
            </li>
            <li>
              <ExternalLink href={links.linkedin_url} className={footerLink}>
                LinkedIn
              </ExternalLink>
            </li>
            <li>
              <ExternalLink href={links.github_url} className={footerLink}>
                GitHub
              </ExternalLink>
            </li>
            {links.resume_href && links.resume_href.trim() !== "" && (
              <li>
                <ExternalLink href={links.resume_href} className={footerLink}>
                  Resume (PDF)
                </ExternalLink>
              </li>
            )}
          </ul>
        </nav>
        <p className="font-mono text-xs text-faint">
          © {year} {name}
        </p>
      </div>
    </footer>
  );
}
