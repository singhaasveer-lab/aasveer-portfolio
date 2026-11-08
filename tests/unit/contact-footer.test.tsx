// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContactSection } from "../../src/components/contact/ContactSection";
import { SiteFooter } from "../../src/components/layout/SiteFooter";
import { links } from "./fixtures";

afterEach(cleanup);

const withEmailAndResume = {
  ...links,
  email: "owner@example.com",
  resume_href: "/resume/fixture.pdf",
};

describe("ContactSection", () => {
  it("shows LinkedIn and GitHub with the required labels and attributes", () => {
    render(<ContactSection links={links} />);
    const linkedin = screen.getByRole("link", { name: /LinkedIn profile.*\(opens in a new tab\)/ });
    const github = screen.getByRole("link", { name: /GitHub profile.*\(opens in a new tab\)/ });
    expect(linkedin.getAttribute("href")).toBe(links.linkedin_url);
    expect(github.getAttribute("href")).toBe(links.github_url);
    for (const a of [linkedin, github]) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });

  it("never shows the email address, a mailto link or the resume, even when they are set", () => {
    const { container } = render(<ContactSection links={withEmailAndResume} />);
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.textContent).not.toContain("owner@example.com");
    expect(screen.queryByRole("link", { name: /Resume/i })).toBeNull();
  });

  it("offers a form with exactly the three labelled fields and a Send message button", () => {
    render(<ContactSection links={links} />);
    const name = screen.getByLabelText("Full name");
    const email = screen.getByLabelText("Email address");
    const message = screen.getByLabelText("Your message");
    expect(name.getAttribute("placeholder")).toBe("Enter your full name");
    expect(email.getAttribute("placeholder")).toBe("Enter your email address");
    expect(email.getAttribute("type")).toBe("email");
    expect(message.tagName).toBe("TEXTAREA");
    expect(message.getAttribute("placeholder")).toBe("Tell me what you'd like to discuss...");
    expect(screen.getByRole("button", { name: /Send message/ })).toBeDefined();
    // The honeypot is the only other input, hidden from assistive technology.
    expect(screen.getByTestId("contact-form").querySelectorAll("input, textarea")).toHaveLength(4);
  });

  it("never renders a phone number", () => {
    const { container } = render(<ContactSection links={withEmailAndResume} />);
    expect(container.textContent).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
    expect(container.querySelector('a[href^="tel:"]')).toBeNull();
  });
});

describe("SiteFooter", () => {
  function hrefs(root: HTMLElement) {
    return [
      ...new Set(
        [...root.querySelectorAll("a")]
          .map((a) => a.getAttribute("href")!)
          .filter((h) => !h.startsWith("#")),
      ),
    ];
  }

  it("shows the name, the current year, and every profile the contact section links to", () => {
    for (const data of [links, withEmailAndResume]) {
      const contact = render(<ContactSection links={data} />);
      const contactHrefs = hrefs(contact.container);
      cleanup();
      const footer = render(<SiteFooter name="Aasveer Singh" links={data} />);
      expect(hrefs(footer.container)).toEqual(expect.arrayContaining(contactHrefs));
      expect(footer.container.textContent).toContain("Aasveer Singh");
      expect(footer.container.querySelector('a[href^="mailto:"]')).toBeNull();
      expect(footer.container.textContent).not.toContain("@");
      expect(footer.container.textContent).toContain(String(new Date().getFullYear()));
      expect(screen.getByRole("link", { name: "Contact" }).getAttribute("href")).toBe("#contact");
      cleanup();
    }
  });
});
