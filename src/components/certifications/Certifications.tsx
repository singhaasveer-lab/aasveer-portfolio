import { CertificationsSection } from "@/components/certifications/CertificationsSection";
import { CredentialOrbit } from "@/components/certifications/orbit/CredentialOrbit";
import { CredentialSpace } from "@/components/certifications/space/CredentialSpace";
import { CERTIFICATIONS_LAYOUT, type CertificationsLayout } from "@/config/layout";
import type { PublicCertification } from "@/lib/validation/schemas";

/**
 * Chooses the certifications layout. All read the same data; the classic archive
 * (CertificationsSection) is kept unchanged so the switch in src/config/layout.ts restores it.
 */
export function Certifications({
  certifications,
  layout = CERTIFICATIONS_LAYOUT,
}: {
  certifications: PublicCertification[];
  layout?: CertificationsLayout;
}) {
  if (layout === "classic") return <CertificationsSection certifications={certifications} />;
  if (layout === "orbit-2d") return <CredentialOrbit certifications={certifications} />;
  return <CredentialSpace certifications={certifications} />;
}
