import type { SkillMap } from "@/lib/explorer/schema";
import { CONNECTIONS_ID } from "@/lib/sections";

/**
 * Engineering Connections: where each skill is applied, as a table beneath About. Every row is a
 * verified link from content/skill-map.json, checked against the project's source; nothing is
 * added to fill the table. On phones the rows stack, so no column is lost to a sideways scroll.
 */
export function EngineeringConnections({
  map,
  projectNames,
}: {
  map: SkillMap;
  projectNames: Record<string, string>;
}) {
  const projectCount = new Set(map.edges.map((e) => e.project)).size;
  return (
    <div id={CONNECTIONS_ID} className="ab-connections" data-testid="engineering-connections">
      <p className="ab-connections-kicker">
        <span aria-hidden="true">D</span> Engineering connections
      </p>
      <h3 className="ab-connections-title display" tabIndex={-1}>
        Where my skills meet real builds.
      </h3>
      <p className="ab-connections-lede">
        An overview of the technical capabilities applied across my projects.
      </p>
      <p className="ab-connections-meta">
        {map.skills.length} skills · {projectCount} projects · {map.edges.length} verified links
      </p>

      <details className="disclosure matrix-table">
        <summary>
          <span>View the connections as a table</span>
          <span className="disclosure-marker" aria-hidden="true" />
        </summary>
        <table data-testid="connections-table">
          <caption className="sr-only">Skills and the projects that use them</caption>
          <thead>
            <tr>
              <th scope="col">Skill</th>
              <th scope="col">Used in</th>
            </tr>
          </thead>
          <tbody>
            {map.skills.map((skill) => (
              <tr key={skill.id}>
                <th scope="row">{skill.label}</th>
                <td>
                  <ul>
                    {map.edges
                      .filter((e) => e.skill === skill.id)
                      .map((edge) => (
                        <li key={edge.project}>
                          <strong>{projectNames[edge.project] ?? edge.project}:</strong> {edge.note}
                        </li>
                      ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
