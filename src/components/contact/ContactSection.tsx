import { ContactForm } from "@/components/contact/ContactForm";
import { SceneItem } from "@/components/motion/Scene";
import { GitHubIcon, LinkedInIcon } from "@/components/ui/Icons";
import type { Links } from "@/lib/validation/schemas";

const strip = (url: string) => url.replace(/^https:\/\//, "");

function ProfileChannel({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="channel">
      <a href={href} target="_blank" rel="noopener noreferrer" className="channel-link">
        <span className="channel-icon">{icon}</span>
        <span className="min-w-0">
          <span className="channel-name">{label}</span>
          <span className="channel-value">{strip(href)}</span>
        </span>
        <span className="channel-note">(opens in a new tab)</span>
        <span className="link-arrow" aria-hidden="true">
          ↗
        </span>
      </a>
    </li>
  );
}

/**
 * The closing scene: an open channel. A message form is the main route in, with the public
 * profiles beside it. No email address or phone number is shown here.
 */
export function ContactSection({ links }: { links: Links }) {
  return (
    <div className="open-channel open-channel-form">
      <SceneItem order={1} className="min-w-0">
        <div className="cf-intro">
          <p className="contact-prompt">
            Have a project in mind, an opportunity to discuss or a technical question? Send me a
            message.
          </p>
          <ul className="channels cf-channels" data-testid="channels">
            <ProfileChannel href={links.github_url} label="GitHub profile" icon={<GitHubIcon />} />
            <ProfileChannel
              href={links.linkedin_url}
              label="LinkedIn profile"
              icon={<LinkedInIcon />}
            />
          </ul>
        </div>
      </SceneItem>

      <SceneItem order={2} from="right" className="min-w-0">
        <ContactForm />
      </SceneItem>
    </div>
  );
}
