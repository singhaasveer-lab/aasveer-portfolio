// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CertificationsSection } from "../../src/components/certifications/CertificationsSection";
import { EducationBlock } from "../../src/components/profile/EducationBlock";
import { SkillGroups } from "../../src/components/profile/SkillGroups";
import { Tag } from "../../src/components/ui/Tag";
import { readContent } from "../../src/lib/content/readContent";
import { CONTENT_DIR } from "../helpers";
import { certifications } from "./fixtures";

afterEach(cleanup);
const content = readContent(CONTENT_DIR);

describe("Tag", () => {
  it("renders text only: not a link, not focusable", () => {
    const { container } = render(<Tag>RAG</Tag>);
    const el = container.firstElementChild!;
    expect(el.tagName).toBe("SPAN");
    expect(el.textContent).toBe("RAG");
    expect(el.hasAttribute("tabindex")).toBe(false);
    expect(container.querySelector("a, button")).toBeNull();
  });
});

describe("SkillGroups", () => {
  it("renders the eight groups in data order as h3 headings with no ratings", () => {
    const { container } = render(<SkillGroups groups={content.skills.groups} />);
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(content.skills.groups.map((g) => g.category));
    expect(container.textContent).not.toMatch(/%/);
    expect(container.querySelector("progress, meter, input[type=range]")).toBeNull();
    // Every skill, exact wording, in data order within its group.
    const rendered = [...container.querySelectorAll(".guide-skills")].map((list) =>
      [...list.querySelectorAll(".skill-name")].map((s) => s.textContent),
    );
    expect(rendered).toEqual(content.skills.groups.map((g) => g.skills));
    expect(rendered.flat()).toHaveLength(55);
  });
});

describe("EducationBlock", () => {
  it("renders the exact education string with an en dash", () => {
    render(<EducationBlock education={content.profile.education} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      "B.Tech, Computer Science & Engineering (AI/ML), Amritsar Group of Colleges, 2023–2027",
    );
  });
});

describe("CertificationsSection", () => {
  const seeded = content.certifications.certifications.map((c) => ({
    ...c,
    featured: false,
    completed_on: null,
    credential_url: null,
    certificate_url: null,
  }));

  it("shows every credential in the default view", () => {
    render(<CertificationsSection certifications={certifications} />);
    expect(screen.getByTestId("vault-status").textContent).toBe("Showing 12 of 12 credentials");
    const groups = screen.getAllByTestId("vault-group");
    expect(groups.flatMap((g) => within(g).getAllByRole("listitem"))).toHaveLength(12);
  });

  it("renders every issuer and course name exactly as the content file gives them", () => {
    const { container } = render(<CertificationsSection certifications={seeded} />);
    const items = [...container.querySelectorAll("li")].map((li) =>
      [
        li.querySelector(".cert-issuer")!.textContent,
        li.querySelector(".cert-course")!.textContent,
      ].join(" | "),
    );
    expect(items.sort()).toEqual(seeded.map((c) => `${c.issuer} | ${c.course_name}`).sort());
  });

  it("filters by issuer and restores the full list", () => {
    render(<CertificationsSection certifications={seeded} />);
    const ibm = screen
      .getAllByTestId("vault-filter")
      .find((b) => b.textContent!.includes("IBM SkillsBuild"))!;
    fireEvent.click(ibm);
    expect(ibm.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("vault-status").textContent).toBe("Showing 3 of 12 credentials");
    fireEvent.click(screen.getByTestId("vault-filter-all"));
    expect(screen.getByTestId("vault-status").textContent).toBe("Showing 12 of 12 credentials");
  });

  it("shows the selected credential's details, with no invented date or link", async () => {
    render(<CertificationsSection certifications={seeded} />);
    const detail = screen.getByTestId("credential-detail");
    expect(detail.textContent).toContain("Claude Code 101");
    expect(detail.textContent).toContain("Anthropic Claude Academy");
    expect(detail.textContent).not.toContain("Completed");
    expect(detail.querySelector("a")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Machine Learning/ }));
    await waitFor(() =>
      expect(screen.getByTestId("credential-detail").textContent).toContain("IBM SkillsBuild"),
    );
  });

  it("shows a date, verification link and certificate only when they exist", () => {
    const withProof = seeded.map((c) =>
      c.course_name === "Claude Code 101"
        ? {
            ...c,
            completed_on: "March 2026",
            credential_url: "https://example.com/verify/1",
            certificate_url: "https://example.com/certificate/1.pdf",
          }
        : c,
    );
    render(<CertificationsSection certifications={withProof} />);
    const detail = screen.getByTestId("credential-detail");
    expect(detail.textContent).toContain("March 2026");
    const links = within(detail).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://example.com/verify/1",
      "https://example.com/certificate/1.pdf",
    ]);
    expect(links[0]!.textContent).toContain("Verify credential");
    expect(links[1]!.textContent).toContain("Open certificate");
  });

  it("collapses an issuer and reopens it", () => {
    render(<CertificationsSection certifications={seeded} />);
    const toggle = screen.getAllByTestId("vault-group-toggle")[0]!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });
});
