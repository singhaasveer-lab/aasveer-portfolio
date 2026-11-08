/** Inline stroke icons (the project has no icon library). Decorative: always aria-hidden. */

export function MailIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function GitHubIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}

export function LinkedInIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M20.45 3H3.55A.55.55 0 0 0 3 3.55v16.9c0 .3.25.55.55.55h16.9c.3 0 .55-.25.55-.55V3.55a.55.55 0 0 0-.55-.55ZM8.34 18.34H5.67V9.75h2.67v8.59ZM7 8.58a1.55 1.55 0 1 1 0-3.1 1.55 1.55 0 0 1 0 3.1Zm11.34 9.76h-2.67v-4.18c0-1 0-2.28-1.39-2.28s-1.6 1.09-1.6 2.21v4.25H10V9.75h2.56v1.17h.04a2.81 2.81 0 0 1 2.53-1.39c2.7 0 3.2 1.78 3.2 4.09v4.72Z" />
    </svg>
  );
}

export function CloseIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function DownloadIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <path
        d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function CommandIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
