"use client";

import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { useActiveWhenVisible } from "@/hooks/useActiveWhenVisible";
import type { About } from "@/lib/explorer/schema";
import type { Profile } from "@/lib/validation/schemas";

/** The degree's years as a ruled scale. Each year is a plain mark: no progress is implied. */
function YearScale({ start, end }: { start: number; end: number }) {
  const ref = useActiveWhenVisible<HTMLDivElement>(true);
  const years = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return (
    <div ref={ref} className="record-scale" aria-hidden="true">
      <span className="record-scale-line" />
      <ol>
        {years.map((year, i) => (
          <li key={year} style={{ "--i": i } as React.CSSProperties}>
            {year}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The academic record: the degree as the primary record, set in three clear levels, beside the
 * earlier schooling on a quieter timeline. It shows only the institution and year from the
 * resume, with no grades. The text comes from content/profile.json unchanged, en dash included.
 */
export function EducationBlock({
  education,
  earlier = [],
}: {
  education: Profile["education"];
  earlier?: About["earlier_education"];
}) {
  const [start, end] = education.period.split(/\s*[–-]\s*/).map(Number);
  const split = education.degree.indexOf(", ");
  const award = split > 0 ? education.degree.slice(0, split) : "";
  const field = split > 0 ? education.degree.slice(split + 2) : education.degree;

  return (
    <div className="record">
      <ScrollReveal preset="left" className="record-primary">
        <p className="record-bar" aria-hidden="true">
          <span>Record 01</span>
          <span>Primary degree</span>
        </p>
        <h3 className="record-title" data-testid="education-entry">
          {award && <span className="record-award">{award}, </span>}
          <span className="record-field">{field},</span>{" "}
          <span className="record-institution">{education.institution},</span>{" "}
          <span className="record-period">{education.period}</span>
        </h3>
        {start && end ? <YearScale start={start} end={end} /> : null}
      </ScrollReveal>

      {earlier.length > 0 && (
        <ScrollReveal preset="right" className="record-history">
          <h4 className="label">Earlier education</h4>
          <ol data-testid="earlier-education">
            {earlier.map((item) => (
              <li key={item.level}>
                <span className="record-year">{item.year}</span>
                <span className="block font-medium text-text">{item.level}</span>
                <span className="block text-sm leading-snug text-muted">{item.institution}</span>
              </li>
            ))}
          </ol>
        </ScrollReveal>
      )}
    </div>
  );
}
