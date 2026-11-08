import { profileResponse } from "@/lib/api/resources";

// Executed once during `next build`; written to out/api/profile.json. No runtime server.
export const dynamic = "force-static";

export function GET(): Response {
  return profileResponse();
}
