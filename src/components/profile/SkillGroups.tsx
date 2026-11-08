import { Stagger } from "@/components/motion/Accents";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { SkillChip } from "@/components/profile/SkillChip";
import type { SkillGroup } from "@/lib/validation/schemas";

/**
 * The resume's skill categories as a compact reference. The Skill Connection Matrix is the main
 * view of the skills, so this stays small: every skill is in the page with nothing to open. A skill
 * with verified uses also opens a list of its projects. Data order is preserved, with no ratings.
 */
export function SkillGroups({
  groups,
  uses = {},
}: {
  groups: SkillGroup[];
  /** Project names for each skill, from the verified skill map. */
  uses?: Record<string, string[]>;
}) {
  return (
    <ol className="skill-system">
      {groups.map((group) => (
        <ScrollReveal
          as="li"
          key={group.category}
          preset="rise"
          className="skill-module"
          data-testid="skill-group"
        >
          <h3 className="skill-module-title">{group.category}</h3>
          <Stagger className="guide-skills" aria-label={group.category}>
            {group.skills.map((skill) =>
              uses[skill]?.length ? (
                <SkillChip key={skill} skill={skill} projects={uses[skill]} />
              ) : (
                <span key={skill} className="skill-name">
                  {skill}
                </span>
              ),
            )}
          </Stagger>
        </ScrollReveal>
      ))}
    </ol>
  );
}
