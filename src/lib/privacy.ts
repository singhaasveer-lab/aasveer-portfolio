/**
 * Contact-detail detection for public output and test data.
 *
 * Detects personal contact details by their shape, not by any stored value: no real email address,
 * phone number or hash of one appears in the repository. Used by the build's release-safety scan
 * (scripts/verify-static.ts) and by the tests that check pages and data never expose contact details.
 */

/** Domains reserved for documentation and tests (RFC 2606, RFC 6761): never a real person's inbox. */
const RESERVED_EMAIL_DOMAIN = /(^|\.)(example\.(com|org|net)|example|test|invalid|localhost)$/i;

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
/** An international number: a "+" country code and 8 to 14 further digits, spaces or dashes allowed. */
const INTERNATIONAL_PHONE = /(?<![\w+])\+\d{1,3}[\s.-]?\d(?:[\s.-]?\d){7,13}(?![\w])/;
/** A ten-digit mobile number starting 6 to 9 (the Indian format), optionally split 5 + 5. */
const MOBILE_PHONE = /(?<![\w.])[6-9]\d{4}[\s-]?\d{5}(?![\w.])/;
/**
 * A link that opens a mail or phone app: "mailto:" with an address, or "tel:" or "sms:" with a
 * number. React's own `tel:!0` (an input-type flag in its code) is not a link.
 */
const CONTACT_LINK = /\bmailto:[^\s"'<>]*@|\b(?:tel|sms):\s*[+\d(]/i;

export type ContactKind = "email address" | "phone number" | "mailto, tel or sms link";

/** Email addresses in the text, other than reserved example and test domains and `allowed` ones. */
export function personalEmails(text: string, allowed: readonly string[] = []): string[] {
  const permitted = new Set(allowed.map((a) => a.toLowerCase()));
  return [...text.matchAll(EMAIL)]
    .map((m) => m[0])
    .filter((address) => !RESERVED_EMAIL_DOMAIN.test(address.split("@")[1]!))
    .filter((address) => !permitted.has(address.toLowerCase()));
}

/**
 * The kinds of contact detail found in `text`, never the values themselves, so a report or test
 * failure cannot repeat what it found. Phone shapes are checked only in `prose` mode: minified
 * code is full of long numbers that are not phone numbers.
 */
export function contactDetails(
  text: string,
  {
    prose = true,
    allowedEmails = [],
  }: {
    prose?: boolean;
    /** Addresses the site may show, read from content/profile.json, never written in code. */
    allowedEmails?: readonly string[];
  } = {},
): ContactKind[] {
  const kinds: ContactKind[] = [];
  if (personalEmails(text, allowedEmails).length > 0) kinds.push("email address");
  if (prose && (INTERNATIONAL_PHONE.test(text) || MOBILE_PHONE.test(text))) {
    kinds.push("phone number");
  }
  let links = text;
  for (const address of allowedEmails) links = links.split(`mailto:${address}`).join("");
  if (CONTACT_LINK.test(links)) kinds.push("mailto, tel or sms link");
  return kinds;
}
