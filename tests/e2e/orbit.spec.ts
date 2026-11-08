import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { CERTIFICATIONS_LAYOUT } from "../../src/config/layout";
import { expect, hydrated, test, type Page } from "./fixtures";

interface Cert {
  issuer: string;
  course_name: string;
  display_order: number;
  completed_on?: string;
  credential_url?: string;
  certificate_url?: string;
  visibility?: string;
}
const certs = (
  JSON.parse(fs.readFileSync("content/certifications.json", "utf8")) as { certifications: Cert[] }
).certifications
  .filter((c) => c.visibility !== "hidden")
  .sort((a, b) => a.display_order - b.display_order);
const academies = [...new Set(certs.map((c) => c.issuer))];
const countOf = (issuer: string) => certs.filter((c) => c.issuer === issuer).length;

test.skip(CERTIFICATIONS_LAYOUT !== "orbit-2d", "Credential Orbit 2.0 is not the active layout");

const stage = (page: Page) => page.getByTestId("orbit-stage");
const cards = (page: Page) => page.getByTestId("orbit-card");
const transformOf = (page: Page, i = 0) =>
  cards(page)
    .nth(i)
    .evaluate((el) => getComputedStyle(el).transform);
/** Rest the pointer inside the stage, away from every card: the orbit holds still. */
const hold = async (page: Page) => {
  const box = (await stage(page).boundingBox())!;
  await page.mouse.move(box.x + 6, box.y + 6);
};
const away = (page: Page) => page.mouse.move(2, 2);
const noOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe("Credential Orbit", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#education-certifications");
    await hydrated(page);
    await page.getByTestId("credential-orbit").scrollIntoViewIfNeeded();
  });

  test("loads every certificate and every academy from the data", async ({ page }) => {
    expect(certs).toHaveLength(12);
    await expect(cards(page)).toHaveCount(certs.length);
    for (const [i, cert] of certs.entries()) {
      await expect(cards(page).nth(i)).toContainText(cert.course_name);
      await expect(cards(page).nth(i)).toContainText(cert.issuer);
    }
    const buttons = page.getByTestId("orbit-academy");
    await expect(buttons).toHaveCount(academies.length);
    for (const [i, issuer] of academies.entries()) {
      await expect(buttons.nth(i)).toContainText(issuer);
      await expect(buttons.nth(i)).toContainText(String(countOf(issuer)));
    }
    await expect(page.getByTestId("orbit-academy-all")).toContainText(String(certs.length));
    await expect(page.getByTestId("orbit-core-count")).toHaveText(String(certs.length));
    const list = page.getByTestId("orbit-list");
    await list.locator("summary").click();
    for (const cert of certs) await expect(list).toContainText(cert.course_name);
  });

  test("each academy brightens its own certificates and dims the rest; All restores", async ({
    page,
  }) => {
    for (const issuer of academies) {
      const button = page.getByTestId("orbit-academy").filter({ hasText: issuer });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      const n = countOf(issuer);
      await expect(page.getByTestId("orbit-status")).toHaveText(
        `Showing ${n} of ${certs.length} credentials · ${issuer}`,
      );
      await expect(page.getByTestId("orbit-core-count")).toHaveText(`${n}/${certs.length}`);
      await expect(page.locator("[data-testid=orbit-card][data-hot]")).toHaveCount(n);
      await expect(page.locator("[data-testid=orbit-card][data-dim]")).toHaveCount(
        certs.length - n,
      );
      for (const card of await page.locator("[data-testid=orbit-card][data-hot]").all()) {
        await expect(card).toContainText(issuer);
      }
      // Dimmed, never hidden: every certificate is still on the orbit.
      await expect(cards(page)).toHaveCount(certs.length);
      for (const card of await cards(page).all()) await expect(card).toBeVisible();
    }
    await page.getByTestId("orbit-academy-all").click();
    await expect(page.getByTestId("orbit-academy-all")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-testid=orbit-card][data-dim]")).toHaveCount(0);
    await expect(page.getByTestId("orbit-status")).toHaveText(
      `Showing ${certs.length} of ${certs.length} credentials · All academies`,
    );
  });

  test("an academy turns its certificates towards the front", async ({ page }) => {
    await hold(page);
    const issuer = academies[1]!;
    await page.getByTestId("orbit-academy").filter({ hasText: issuer }).click();
    await hold(page);
    await page.waitForTimeout(1600);
    const depth = await page.evaluate(() => {
      const all = [...document.querySelectorAll<HTMLElement>("[data-testid=orbit-card]")];
      const y = (el: HTMLElement) => parseFloat(el.style.getPropertyValue("--y"));
      const hot = all.filter((el) => el.hasAttribute("data-hot")).map(y);
      const rest = all.filter((el) => !el.hasAttribute("data-hot")).map(y);
      const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
      return { hot: mean(hot), rest: mean(rest) };
    });
    // The front of the orbit is the bottom of the stage.
    expect(depth.hot).toBeGreaterThan(depth.rest);
  });

  test("moves continuously, keeps every card upright, and pauses on hover", async ({ page }) => {
    await away(page);
    const first = await transformOf(page);
    await page.waitForTimeout(1200);
    const later = await transformOf(page);
    expect(later).not.toBe(first);
    for (const t of [first, later]) {
      // Translate and scale only: no rotation or skew, so text stays upright.
      const m = new RegExp(/matrix\(([^)]+)\)/).exec(t)![1]!.split(",").map(Number);
      expect(m[1]).toBeCloseTo(0, 5);
      expect(m[2]).toBeCloseTo(0, 5);
      expect(m[0]).toBeGreaterThan(0.8);
      expect(m[0]).toBeCloseTo(m[3]!, 5);
    }
    await hold(page);
    await page.waitForTimeout(200);
    const held = await transformOf(page);
    await page.waitForTimeout(1000);
    expect(await transformOf(page)).toBe(held);
    await away(page);
    await page.waitForTimeout(1000);
    expect(await transformOf(page)).not.toBe(held);
  });

  test("the pause button stops the orbit and resumes it", async ({ page }) => {
    const pause = page.getByTestId("orbit-pause");
    await pause.click();
    await expect(pause).toHaveAttribute("aria-pressed", "true");
    await expect(pause).toHaveText("Resume orbit");
    await away(page);
    const held = await transformOf(page);
    await page.waitForTimeout(1000);
    expect(await transformOf(page)).toBe(held);
    await pause.click();
    await away(page);
    await page.waitForTimeout(1000);
    expect(await transformOf(page)).not.toBe(held);
  });

  test("keyboard focus inside the orbit holds it still", async ({ page }) => {
    await away(page);
    await cards(page).nth(4).focus();
    await page.waitForTimeout(200);
    const held = await transformOf(page, 4);
    await page.waitForTimeout(1000);
    expect(await transformOf(page, 4)).toBe(held);
    const outline = await cards(page)
      .nth(4)
      .evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });

  test("every certificate opens its record, and closing keeps the academy", async ({ page }) => {
    const issuer = academies[0]!;
    await page.getByTestId("orbit-academy").filter({ hasText: issuer }).click();
    for (const [i, cert] of certs.entries()) {
      await hold(page);
      await cards(page).nth(i).click();
      const panel = page.getByTestId("orbit-panel");
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("heading", { level: 4 })).toHaveText(cert.course_name);
      await expect(panel.getByRole("heading", { level: 4 })).toBeFocused();
      await expect(panel).toContainText(cert.issuer);
      await expect(panel).toContainText(cert.completed_on ?? "Not recorded");
      if (cert.certificate_url) {
        await expect(panel.getByTestId("orbit-view-certificate")).toHaveAttribute(
          "href",
          cert.certificate_url,
        );
      } else {
        await expect(panel.getByTestId("orbit-view-certificate")).toHaveCount(0);
      }
      if (!cert.certificate_url && !cert.credential_url) {
        await expect(panel.getByTestId("orbit-no-document")).toBeVisible();
        await expect(panel.locator("a")).toHaveCount(0);
        await expect(panel.locator("img")).toHaveCount(0);
      }
      if (i % 2) await page.keyboard.press("Escape");
      else await panel.getByTestId("orbit-close").click();
      await expect(page.getByTestId("orbit-panel")).toHaveCount(0);
      await expect(cards(page).nth(i)).toBeFocused();
      await expect(page.getByTestId("orbit-academy").filter({ hasText: issuer })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
  });

  test("academies can be chosen from the keyboard", async ({ page }) => {
    const all = page.getByTestId("orbit-academy-all");
    await all.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("orbit-academy").first()).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("orbit-academy").nth(1)).toHaveAttribute("aria-pressed", "true");
  });

  test("has no accessibility violations and logs no errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await hydrated(page);
    await page.getByTestId("credential-orbit").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    const audit = async () => {
      const { violations } = await new AxeBuilder({ page })
        .include("[data-testid=credential-orbit]")
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
    };
    await audit();
    await page.getByTestId("orbit-academy").filter({ hasText: "IBM SkillsBuild" }).click();
    await page.waitForTimeout(600);
    await audit();
    await cards(page).nth(2).click();
    await page.waitForTimeout(600);
    await audit();
    expect(errors).toEqual([]);
  });
});

test.describe("Credential Orbit without motion or JavaScript", () => {
  test("reduced motion: a still, readable orbit that keeps every interaction", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/#education-certifications");
    await hydrated(page);
    await page.getByTestId("credential-orbit").scrollIntoViewIfNeeded();
    await away(page);
    const first = await transformOf(page);
    await page.waitForTimeout(1200);
    expect(await transformOf(page)).toBe(first);
    await expect(page.getByTestId("orbit-pause")).toHaveCount(0);
    const streak = await page
      .locator(".co-streak")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(streak).toBe("none");
    await page.getByTestId("orbit-academy").filter({ hasText: "Cisco" }).click();
    await expect(page.locator("[data-testid=orbit-card][data-hot]")).toHaveCount(1);
    await cards(page).first().click();
    await expect(page.getByTestId("orbit-panel")).toBeVisible();
    await context.close();
  });

  test("every certificate is in the page without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/#education-certifications");
    await expect(cards(page)).toHaveCount(certs.length);
    const text = await page.getByTestId("credential-orbit").textContent();
    for (const cert of certs) expect(text).toContain(cert.course_name);
    await context.close();
  });
});

for (const [width, height] of [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1024, 800],
  [1440, 900],
  [1920, 1080],
] as const) {
  test(`Credential Orbit fits and works at ${width}px`, async ({ browser }) => {
    const touch = width < 1024;
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    await page.goto("/#education-certifications");
    await hydrated(page);
    await page.getByTestId("credential-orbit").scrollIntoViewIfNeeded();
    await noOverflow(page);
    const press = async (locator: ReturnType<Page["locator"]>) =>
      touch ? locator.tap() : locator.click();

    if (width < 768) {
      // Phones: one certificate at the front; every other one is a step away.
      const visible = page.locator("[data-testid=orbit-card]:not([data-hidden])");
      await expect(visible).toHaveCount(1);
      const seen = new Set<string>();
      for (let i = 0; i < certs.length; i++) {
        seen.add((await visible.locator(".co-card-title").textContent())!);
        await press(page.getByTestId("orbit-next"));
      }
      expect([...seen].sort()).toEqual(certs.map((c) => c.course_name).sort());
      await press(page.getByTestId("orbit-academy").filter({ hasText: "Microsoft Learn" }));
      await expect(visible).toContainText("Microsoft Learn");
      await press(visible);
      await expect(page.getByTestId("orbit-panel")).toBeVisible();
      await press(page.getByTestId("orbit-close"));
      await expect(page.getByTestId("orbit-panel")).toHaveCount(0);
    } else {
      // Every card stays inside the stage.
      await stage(page)
        .hover({ position: { x: 6, y: 6 } })
        .catch(() => {});
      const box = (await stage(page).boundingBox())!;
      for (const card of await cards(page).all()) {
        const c = (await card.boundingBox())!;
        expect(c.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(c.x + c.width).toBeLessThanOrEqual(box.x + box.width + 1);
        expect(c.y).toBeGreaterThanOrEqual(box.y - 1);
        expect(c.y + c.height).toBeLessThanOrEqual(box.y + box.height + 1);
      }
      await press(page.getByTestId("orbit-academy").filter({ hasText: "IBM SkillsBuild" }));
      await expect(page.locator("[data-testid=orbit-card][data-hot]")).toHaveCount(3);
    }
    await noOverflow(page);
    for (const button of await page.getByTestId("orbit-academy").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await context.close();
  });
}
