/**
 * The contact form's rules and its one network call, kept apart from the component so they can be
 * tested without a browser. Messages go to an external form service named by
 * NEXT_PUBLIC_CONTACT_FORM_ENDPOINT at build time; the static site has no server of its own.
 */

export interface ContactFields {
  name: string;
  email: string;
  message: string;
}

export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

export const LIMITS = { name: 120, email: 254, message: 5000 } as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateContact(fields: ContactFields): ContactErrors {
  const errors: ContactErrors = {};
  const name = fields.name.trim();
  const email = fields.email.trim();
  const message = fields.message.trim();

  if (!name) errors.name = "Enter your full name.";
  else if (name.length > LIMITS.name)
    errors.name = `Keep your name under ${LIMITS.name} characters.`;

  if (!email) errors.email = "Enter your email address.";
  else if (email.length > LIMITS.email || !EMAIL.test(email))
    errors.email = "Enter a valid email address, like name@example.com.";

  if (!message) errors.message = "Enter a message.";
  else if (message.length > LIMITS.message)
    errors.message = `Keep your message under ${LIMITS.message} characters.`;

  return errors;
}

/** The configured endpoint, or null when none is set or it is not an https URL. */
export function contactEndpoint(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

export type SubmitResult = { ok: true } | { ok: false; reason: "rejected" | "network" | "timeout" };

/**
 * Sends the message as JSON. Success is reported only when the service answers with a 2xx status
 * and does not say otherwise in its body. `_gotcha` is the honeypot: real visitors leave it empty,
 * and services that support it discard submissions where it is filled.
 */
export async function submitContact(
  endpoint: string,
  fields: ContactFields & { honeypot: string },
  fetcher: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<SubmitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fields.name.trim(),
        email: fields.email.trim(),
        message: fields.message.trim(),
        _gotcha: fields.honeypot,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, reason: "rejected" };
    const body: unknown = await response.json().catch(() => null);
    if (body && typeof body === "object" && "ok" in body && body.ok === false) {
      return { ok: false, reason: "rejected" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: controller.signal.aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
