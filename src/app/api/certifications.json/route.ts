import { certificationsResponse } from "@/lib/api/resources";

// Executed once during `next build`; written to out/api/certifications.json. No runtime server.
export const dynamic = "force-static";

export function GET(): Response {
  return certificationsResponse();
}
