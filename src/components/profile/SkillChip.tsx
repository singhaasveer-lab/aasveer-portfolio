"use client";

import {
  MorphingPopover,
  MorphingPopoverContent,
  MorphingPopoverTrigger,
} from "@/components/motion-primitives/morphing-popover";
import { CONNECTIONS_ID } from "@/lib/sections";

/** A skill with verified uses: selecting it lists the projects, with a way on to Engineering Connections. */
export function SkillChip({ skill, projects }: { skill: string; projects: string[] }) {
  return (
    <MorphingPopover className="skill-pop">
      <MorphingPopoverTrigger className="skill-name skill-chip">{skill}</MorphingPopoverTrigger>
      <MorphingPopoverContent className="skill-popover" label={`Projects that use ${skill}`}>
        <p className="label">Used in</p>
        <ul>
          {projects.map((project) => (
            <li key={project}>{project}</li>
          ))}
        </ul>
        <a href={`#${CONNECTIONS_ID}`}>See all connections</a>
      </MorphingPopoverContent>
    </MorphingPopover>
  );
}
