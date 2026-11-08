"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ProjectView } from "@/lib/data/loadPortfolio";
import type { Architecture } from "@/lib/explorer/schema";

interface ExplorerState {
  projects: ProjectView[];
  architectures: Architecture[];
  /** The Laboratory module on show; null until a visitor picks one. */
  labModule: string | null;
  setLabModule: (id: string) => void;
  /** The project whose architecture overlay is open. */
  architecture: string | null;
  openArchitecture: (slug: string) => void;
  closeArchitecture: () => void;
  /** Whether the NEXUS Command Centre is open. */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

const ExplorerContext = createContext<ExplorerState | null>(null);

/**
 * Links the page's interactive systems, so the skill map and command centre can open an
 * architecture or a Laboratory module, and project data is passed down only once.
 */
export function ExplorerProvider({
  projects,
  architectures,
  children,
}: {
  projects: ProjectView[];
  architectures: Architecture[];
  children: React.ReactNode;
}) {
  const [labModule, setLabModule] = useState<string | null>(null);
  const [architecture, setArchitecture] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  const value = useMemo(
    () => ({
      projects,
      architectures,
      labModule,
      setLabModule,
      architecture,
      openArchitecture: setArchitecture,
      closeArchitecture: () => setArchitecture(null),
      commandOpen,
      setCommandOpen,
    }),
    [projects, architectures, labModule, architecture, commandOpen],
  );

  return <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>;
}

export function useExplorer() {
  const state = useContext(ExplorerContext);
  if (!state) throw new Error("useExplorer must be used inside ExplorerProvider");
  return state;
}

/** For components that also render outside the explorer, such as a project card in isolation. */
export function useOptionalExplorer() {
  return useContext(ExplorerContext);
}
