interface ExternalLinkProps {
  href: string;
  /** Visible, descriptive link text. "(opens in a new tab)" is appended. */
  children: React.ReactNode;
  className?: string;
  /** Optional secondary line, such as the URL itself, shown under the label. */
  detail?: string;
}

/** The only way external links are rendered: new tab, noopener noreferrer, and a visible notice. */
export function ExternalLink({
  href,
  children,
  className = "link-row",
  detail,
}: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <span className="flex min-w-0 flex-col">
        <span>
          {children} <span className="text-[0.8rem] text-muted">(opens in a new tab)</span>
        </span>
        {detail && <span className="mt-1 font-mono text-xs break-all text-faint">{detail}</span>}
      </span>
      <span className="link-arrow" aria-hidden="true">
        ↗
      </span>
    </a>
  );
}
