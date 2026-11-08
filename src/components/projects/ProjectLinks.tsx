import { ExternalLink } from "@/components/ui/ExternalLink";

interface ProjectLinksProps {
  displayName: string;
  repositoryUrl: string;
  demoUrl: string | null;
}

/** Repository link (always, for a published project) and a demo link only when one is verified. */
export function ProjectLinks({ displayName, repositoryUrl, demoUrl }: ProjectLinksProps) {
  return (
    <ul className="flex flex-col gap-2">
      <li>
        <ExternalLink href={repositoryUrl} detail={repositoryUrl.replace(/^https:\/\//, "")}>
          {displayName} repository
        </ExternalLink>
      </li>
      {demoUrl && demoUrl.trim() !== "" && (
        <li>
          <ExternalLink href={demoUrl}>Live demo</ExternalLink>
        </li>
      )}
    </ul>
  );
}
