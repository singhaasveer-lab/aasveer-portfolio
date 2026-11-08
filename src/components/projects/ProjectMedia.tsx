"use client";

import dynamic from "next/dynamic";

/** Both load on demand: the code is fetched when a case study opens, never with the page. */
export const LazyComparison = dynamic(
  () => import("@/components/projects/ProjectComparison").then((m) => m.ProjectComparison),
  { ssr: false, loading: () => <div className="case-compare" aria-hidden="true" /> },
);

export const LazyGallery = dynamic(
  () => import("@/components/projects/ProjectGallery").then((m) => m.ProjectGallery),
  { ssr: false },
);
