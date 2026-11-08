import { describe, expect, it } from "vitest";
import { contactDetails, personalEmails } from "../../src/lib/privacy";

// Every value here is synthetic: invented addresses and numbers in documentation ranges.
describe("contactDetails", () => {
  it("finds an email address and a mailto link without repeating them", () => {
    const found = contactDetails('<a href="mailto:jane@mailhost.io">jane@mailhost.io</a>');
    expect(found).toEqual(["email address", "mailto, tel or sms link"]);
    expect(JSON.stringify(found)).not.toContain("jane");
  });

  it("finds international and ten-digit mobile phone numbers in several layouts", () => {
    for (const text of [
      "+44 20 7946 0958",
      "+1-555-010-0199",
      "call +15550100199",
      "9000012345",
      "90000 12345",
      "90000-12345",
    ]) {
      expect(contactDetails(text), text).toContain("phone number");
    }
  });

  it("finds tel and sms links", () => {
    expect(contactDetails('href="tel:+15550100199"')).toContain("mailto, tel or sms link");
    expect(contactDetails("sms:5550100")).toContain("mailto, tel or sms link");
  });

  it("ignores reserved example domains, React's tel flag, years, prices and ids", () => {
    for (const text of [
      "owner@example.com",
      "someone@site.test",
      'type:"tel"',
      "tel:!0",
      "2024-2026",
      "₹1,20,000",
      "build 1234567890123",
      "v1.2.3",
    ]) {
      expect(contactDetails(text), text).toEqual([]);
    }
  });

  it("skips phone shapes outside prose mode", () => {
    expect(contactDetails("9000012345", { prose: false })).toEqual([]);
  });

  it("allows only the addresses it is given, and their mailto links", () => {
    const text = '<a href="mailto:jane@mailhost.io">jane@mailhost.io</a> bob@mailhost.io';
    expect(personalEmails(text, ["JANE@mailhost.io"])).toEqual(["bob@mailhost.io"]);
    expect(
      contactDetails('<a href="mailto:jane@mailhost.io">x</a>', {
        allowedEmails: ["jane@mailhost.io"],
      }),
    ).toEqual([]);
    expect(contactDetails(text, { allowedEmails: ["jane@mailhost.io"] })).toEqual([
      "email address",
    ]);
  });
});
