import AxeBuilder from "@axe-core/playwright";
import { contactDetails, personalEmails } from "../../src/lib/privacy";
import { expect, hydrated, test, type Page } from "./fixtures";

const PROJECTS = [
  "InterviewIQ",
  "Wingman AI",
  "GiftBro AI",
  "StudyForge AI",
  "SmartQueue AI",
  "PennyBloom",
];
const RESUME = "Aasveer_Singh_AI_ML_Engineer_Resume_v3_fnl.pdf";

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Fails a test on any console error or uncaught exception. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Opens a project's case study from its card. */
const openCase = async (page: Page, name: string) => {
  await page.getByRole("button", { name: `Read case study: ${name}` }).click();
  const dialog = page.getByTestId("case-dialog").and(page.locator("[open]"));
  await expect(dialog.getByRole("heading", { level: 2, name })).toBeVisible();
  return dialog;
};

/** Opens a project's architecture from its case study. */
const openArchitecture = async (page: Page, name: string) => {
  await page.goto("/#projects");
  const study = await openCase(page, name);
  await study.getByRole("button", { name: `Explore architecture of ${name}` }).click();
  const dialog = page.getByTestId("architecture-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
};

const openNexus = async (page: Page) => {
  await page.getByTestId("nexus-launcher").click();
  await page.getByTestId("nexus-open").click();
  await expect(page.getByRole("dialog", { name: "NEXUS Command Centre" })).toBeVisible();
};

const runCommand = async (page: Page, label: string) => {
  await openNexus(page);
  await page.getByRole("option", { name: label }).click();
  await expect(page.getByTestId("nexus-dialog")).toBeHidden();
};

test.describe("AI Systems Laboratory", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/#ai-lab");
  });

  test("every module opens its own workflow", async ({ page }) => {
    for (const [id, stage, title] of [
      ["llm-evaluation", "evaluation", "AI evaluation"],
      ["nlp", "signals", "Signal analysis"],
      ["recommendation", "ranking", "Weighted ranking"],
      ["data-analytics", "estimate", "Trends and estimates"],
      ["queue", "dispatch", "Smart dispatch"],
      ["ocr", "extraction", "OCR extraction"],
      ["rag", "retrieval", "Retrieval"],
    ] as const) {
      await page.getByTestId(`lab-tab-${id}`).click();
      await expect(page.getByTestId("lab-panel")).toHaveAttribute("data-module", id);
      await page.getByTestId(`lab-stage-${stage}`).click();
      await expect(page.getByTestId(`lab-stage-${stage}`)).toHaveAttribute("aria-current", "step");
      await expect(
        page.getByTestId("lab-stage-panel").getByRole("heading", { name: title }),
      ).toBeVisible();
    }
  });

  test("selecting a stage shows its input, output and source", async ({ page }) => {
    await page.getByTestId("lab-stage-retrieval").click();
    const panel = page.getByTestId("lab-stage-panel");
    await expect(panel).toContainText("Top 3 entries");
    await expect(panel).toContainText("core/rag.py");
    await expect(panel).toContainText("TfidfVectorizer");
  });

  test("comparing RAG implementations shows what each project really does", async ({ page }) => {
    const panel = page.getByTestId("lab-stage-panel");
    await page.getByTestId("lab-stage-generation").click();
    await expect(panel).toContainText("Not used in Wingman AI");
    await page.getByTestId("lab-variant-studyforge-ai").click();
    await expect(panel).toContainText("In StudyForge AI");
    await expect(panel).toContainText("Gemini receives");
    await page.getByTestId("lab-stage-chunking").click();
    await expect(panel).toContainText("180 words");
  });

  test("the recommendation module separates ranking from Gemini", async ({ page }) => {
    await page.getByTestId("lab-tab-recommendation").click();
    await expect(page.locator(".lab-legend")).toContainText("Product ranking");
    await expect(page.locator(".lab-legend")).toContainText("Gemini personalization");
    await page.getByTestId("lab-stage-gemini").click();
    await expect(page.getByTestId("lab-stage-panel")).toContainText(
      "Only recommend the supplied candidates.",
    );
  });

  test("every module has a system switcher, and all six projects appear", async ({ page }) => {
    const systems: Record<string, string[]> = {
      rag: ["Wingman AI", "StudyForge AI", "InterviewIQ"],
      "llm-evaluation": ["InterviewIQ", "StudyForge AI", "GiftBro AI"],
      nlp: ["Wingman AI", "StudyForge AI"],
      recommendation: ["GiftBro AI"],
      "data-analytics": ["PennyBloom", "SmartQueue AI"],
      queue: ["SmartQueue AI"],
      ocr: ["Wingman AI"],
    };
    expect([...new Set(Object.values(systems).flat())].sort()).toEqual([...PROJECTS].sort());
    for (const [id, names] of Object.entries(systems)) {
      await page.getByTestId(`lab-tab-${id}`).click();
      // The previous module fades out first, so this waits for the new switcher.
      await expect(
        page.getByRole("group", { name: "Compare implementations" }).getByRole("button"),
      ).toHaveText(names);
    }
  });

  test("InterviewIQ joins the RAG comparison, showing what it does not have", async ({ page }) => {
    await page.getByTestId("lab-variant-interviewiq").click();
    await page.getByTestId("lab-stage-generation").click();
    const panel = page.getByTestId("lab-stage-panel");
    await expect(panel).toContainText("Not used in InterviewIQ");
    await page.getByTestId("lab-stage-retrieval").click();
    await expect(panel).toContainText("no TF-IDF and no embeddings");
  });

  test("the new modules compare their systems stage by stage", async ({ page }) => {
    await page.getByTestId("lab-tab-llm-evaluation").click();
    await page.getByTestId("lab-stage-evaluation").click();
    const panel = page.getByTestId("lab-stage-panel");
    await expect(panel).toContainText("technical, communication, problem solving and confidence");
    await page.getByTestId("lab-variant-studyforge-ai").click();
    await expect(panel).toContainText("Not used in StudyForge AI");
    await page.getByTestId("lab-tab-data-analytics").click();
    await page.getByTestId("lab-stage-storage").click();
    await expect(page.getByTestId("lab-stage-panel")).toContainText("SHA-256");
    await page.getByTestId("lab-variant-smartqueue-ai").click();
    await expect(page.getByTestId("lab-stage-panel")).toContainText("localStorage");
  });

  test("the module rack works from the keyboard", async ({ page }) => {
    await page.getByTestId("lab-tab-rag").focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByTestId("lab-tab-llm-evaluation")).toBeFocused();
    await expect(page.getByTestId("lab-panel")).toHaveAttribute("data-module", "llm-evaluation");
    await page.keyboard.press("End");
    await expect(page.getByTestId("lab-panel")).toHaveAttribute("data-module", "ocr");
  });

  test("tracing the signal advances through stages and stops when asked", async ({ page }) => {
    await page.getByTestId("lab-trace").click();
    await expect(page.getByTestId("lab-stage-processing")).toHaveAttribute("aria-current", "step");
    await page.getByTestId("lab-trace").click();
    await expect(page.getByTestId("lab-trace")).toHaveAttribute("aria-pressed", "false");
  });

  test("the queue simulator is labelled, and applies SmartQueue AI's rules", async ({ page }) => {
    await page.getByTestId("lab-tab-queue").click();
    const sim = page.getByTestId("queue-sim");
    await expect(sim).toContainText("Simulation: illustrative tokens");
    await expect(page.getByTestId("queue-congestion")).toHaveText("Low");

    await page.getByTestId("queue-call").click();
    await expect(page.getByTestId("queue-status")).toHaveText("PRI-103 called to Counter 1.");

    await sim.getByRole("button", { name: "Close Counter 3" }).click();
    await sim.getByRole("button", { name: "Close Counter 2" }).click();
    await expect(page.getByTestId("queue-congestion")).toHaveText("High");

    await sim.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByTestId("queue-tokens").locator("li")).toHaveCount(4);
  });
});

test.describe("architecture explorer", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("all six project cards remain and open their own architecture", async ({ page }) => {
    test.slow(); // It opens and closes six overlays in turn.
    await page.goto("/#projects");
    await expect(page.getByTestId("project-card")).toHaveCount(6);
    for (const name of PROJECTS) {
      const study = await openCase(page, name);
      await study.getByRole("button", { name: `Explore architecture of ${name}` }).click();
      const dialog = page.getByTestId("architecture-dialog");
      await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(name);
      await expect(dialog.locator(".arch-node").first()).toBeVisible();
      await page.getByTestId("architecture-close").click();
      await expect(dialog).toBeHidden();
      await page.keyboard.press("Escape");
      await expect(study).toHaveCount(0);
    }
  });

  test("a node opens its detail and highlights only its connections", async ({ page }) => {
    await openArchitecture(page, "StudyForge AI");
    await page.getByTestId("arch-mode-engineering").click();
    await page.getByTestId("arch-node-sqlite").click();

    const detail = page.getByTestId("arch-detail");
    await expect(detail).toHaveAttribute("data-node", "sqlite");
    for (const field of ["Responsibility", "Inputs", "Outputs", "Technologies"]) {
      await expect(detail.getByText(field, { exact: true })).toBeVisible();
    }
    await expect(detail.getByText("Communicates with")).toBeVisible();

    const lit = await page
      .locator("[data-testid=arch-canvas] [data-edge][data-lit]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-edge")).sort());
    expect(lit).toEqual(["chunker>sqlite", "sqlite>retrieval", "study>sqlite"]);
    await expect(page.getByTestId("arch-node-groq")).toHaveAttribute("data-dim", "true");
  });

  test("a connection in the detail panel moves to that component", async ({ page }) => {
    await openArchitecture(page, "Wingman AI");
    await page.getByTestId("arch-mode-engineering").click();
    await page.getByTestId("arch-node-rag").click();
    await page
      .getByTestId("arch-detail")
      .getByRole("button", { name: /Knowledge base/ })
      .click();
    await expect(page.getByTestId("arch-detail")).toHaveAttribute("data-node", "kb");
  });

  test("system view is simpler, and engineering view adds traceable flows", async ({ page }) => {
    await openArchitecture(page, "GiftBro AI");
    const nodes = page.getByTestId("arch-canvas").locator(".arch-node");
    const system = await nodes.count();
    await expect(page.getByTestId("arch-flow")).toHaveCount(0);

    await page.getByTestId("arch-mode-engineering").click();
    await expect.poll(() => nodes.count()).toBeGreaterThan(system);

    await page.getByTestId("arch-flow").filter({ hasText: "Gemini layer" }).click();
    const lit = await page
      .locator("[data-testid=arch-canvas] [data-edge][data-lit]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-edge")).sort());
    expect(lit).toEqual(["gemini>results", "ranker>gemini"]);
  });

  test("Escape closes the explorer alone, then the case study, returning focus each time", async ({
    page,
  }) => {
    const dialog = await openArchitecture(page, "InterviewIQ");
    const study = page.getByTestId("case-dialog").and(page.locator("[open]"));
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(study).toBeVisible();
    await expect(
      study.getByRole("button", { name: "Explore architecture of InterviewIQ" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(study).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Read case study: InterviewIQ" })).toBeFocused();
  });

  test("focus stays inside the open explorer", async ({ page }) => {
    await openArchitecture(page, "InterviewIQ");
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => {
        const active = document.activeElement;
        return active === document.body || !!active?.closest("dialog[open]");
      });
      expect(inside).toBe(true);
    }
  });

  test("becomes a readable vertical flow on phones", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openArchitecture(page, "Wingman AI");
    await expect(page.getByTestId("arch-canvas")).toHaveCount(0);
    const flow = page.getByTestId("arch-flowlist");
    await expect(flow).toBeVisible();
    await flow.getByTestId("arch-node-streamlit").click();
    await expect(flow.getByTestId("arch-detail")).toContainText("Responsibility");
    const fits = await flow.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
  });
});

test.describe("NEXUS Command Centre", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
  });

  test("the launcher stays visible and opens by mouse click", async ({ page }) => {
    const launcher = page.getByRole("button", { name: "NEXUS / EXPLORE" });
    await expect(launcher).toBeInViewport();
    await page.mouse.wheel(0, 3000);
    await expect(launcher).toBeInViewport();
    await launcher.click();
    await page.getByTestId("nexus-open").click();
    await expect(page.getByTestId("nexus-input")).toBeFocused();
  });

  test("typing filters the commands, and says when nothing matches", async ({ page }) => {
    await openNexus(page);
    await page.getByTestId("nexus-input").fill("rag");
    await expect(page.getByRole("option", { name: /EXPLORE RAG/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /GO TO PROJECTS/ })).toHaveCount(0);
    await page.getByTestId("nexus-input").fill("quantum blockchain");
    await expect(page.getByTestId("nexus-empty")).toBeVisible();
  });

  for (const [width, height] of [
    [320, 640],
    [390, 844],
    [768, 1024],
    [1024, 768],
    [1279, 800],
    [1440, 900],
  ] as const) {
    test(`the launcher sits in the header's row and covers nothing at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const launcher = page.getByTestId("nexus-launcher");
      const box = (await launcher.boundingBox())!;
      const header = (await page.locator(".site-header").boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(header.y);
      expect(box.y + box.height).toBeLessThanOrEqual(header.y + header.height);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      await expect(launcher).toHaveAccessibleName(/NEXUS/);
      // Nothing else in the header's row touches it.
      const clash = await launcher.evaluate((button) => {
        const a = button.getBoundingClientRect();
        const own = button.closest(".nexus-toolbar")!;
        return [...own.parentElement!.children].some((other) => {
          if (other === own) return false;
          const b = other.getBoundingClientRect();
          if (b.width === 0) return false;
          return a.left < b.right && b.left < a.right;
        });
      });
      expect(clash).toBe(false);
      if (width < 1280) expect(Math.round(box.width)).toBe(Math.round(box.height));
    });
  }

  test("opens the two new Laboratory modules", async ({ page }) => {
    await runCommand(page, "EXPLORE LLM EVALUATION");
    await expect(page.getByTestId("lab-panel")).toHaveAttribute("data-module", "llm-evaluation");
    await runCommand(page, "EXPLORE DATA ANALYTICS");
    await expect(page.getByTestId("lab-panel")).toHaveAttribute("data-module", "data-analytics");
  });

  test("the arrow keys and Enter run a command", async ({ page }) => {
    await openNexus(page);
    for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown");
    const active = page.locator('[role="option"][aria-selected="true"]');
    await expect(active).toContainText("OPEN AI SYSTEMS LAB");
    await expect(page.getByTestId("nexus-input")).toHaveAttribute(
      "aria-activedescendant",
      "command-section-ai-lab",
    );
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#ai-lab$/);
    await expect(page.locator("#ai-lab-heading")).toBeFocused();
  });

  test("Escape closes it and returns focus to the launcher", async ({ page }) => {
    await openNexus(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("nexus-dialog")).toBeHidden();
    await expect(page.getByTestId("nexus-launcher")).toBeFocused();
  });

  test("the close button closes it", async ({ page }) => {
    await openNexus(page);
    await page.getByTestId("nexus-close").click();
    await expect(page.getByTestId("nexus-dialog")).toBeHidden();
  });

  test("EXPLORE RAG opens the module; the others open their target", async ({ page }) => {
    await runCommand(page, "EXPLORE OCR");
    await expect(page.getByTestId("lab-panel")).toHaveAttribute("data-module", "ocr");
    await runCommand(page, "EXPLORE RAG");
    await expect(page.getByTestId("lab-panel")).toHaveAttribute("data-module", "rag");
    await runCommand(page, "OPEN SMARTQUEUE AI");
    await expect(page.getByTestId("queue-sim")).toBeVisible();
    await runCommand(page, "OPEN EVIDENCE ENGINE");
    await expect(page).toHaveURL(/#evidence$/);
    await runCommand(page, "VIEW ENGINEERING CONNECTIONS");
    await expect(page).toHaveURL(/#engineering-connections$/);
    await runCommand(page, "EXPLORE WINGMAN AI");
    await expect(page.getByRole("dialog", { name: "Wingman AI" })).toBeVisible();
  });

  test("DOWNLOAD RESUME downloads the approved PDF", async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      runCommand(page, "DOWNLOAD RESUME"),
    ]);
    expect(download.suggestedFilename()).toBe(RESUME);
  });

  test("GitHub and LinkedIn commands follow the right links; there is no email command", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const visited: string[] = [];
      (window as unknown as { visited: string[] }).visited = visited;
      HTMLAnchorElement.prototype.click = function () {
        visited.push(`${this.href} ${this.target}`.trim());
      };
    });
    await runCommand(page, "OPEN GITHUB");
    await runCommand(page, "OPEN LINKEDIN");
    const visited = await page.evaluate(() => (window as unknown as { visited: string[] }).visited);
    expect(visited).toEqual([
      "https://github.com/singhaasveer-lab _blank",
      "https://linkedin.com/in/aasveer-singh _blank",
    ]);
  });

  test("Ctrl+K also opens it", async ({ page }) => {
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("nexus-input")).toBeFocused();
  });

  test("on a phone it opens and runs by tap, inside the screen", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto("/");
    await hydrated(page);
    await page.getByTestId("nexus-launcher").tap();
    await page.getByTestId("nexus-open").tap();
    const panel = page.locator(".nexus-panel");
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(844);
    await page.getByRole("option", { name: /GO TO PROJECTS/ }).tap();
    await expect(page).toHaveURL(/#projects$/);
    await context.close();
  });
});

test.describe("PennyBloom", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("its card shows verified details and links to the repository", async ({ page }) => {
    await page.goto("/#projects");
    const card = page.getByRole("article", { name: "PennyBloom" });
    await expect(card).toContainText("Personal Finance Management Platform");
    const study = await openCase(page, "PennyBloom");
    await expect(study.getByRole("link", { name: /PennyBloom repository/ })).toHaveAttribute(
      "href",
      "https://github.com/singhaasveer-lab/PennyBloom",
    );
    await expect(study.getByTestId("project-role")).toHaveCount(0);
    await expect(study.getByRole("link", { name: /demo/i })).toHaveCount(0);
  });

  test("its architecture opens and traces a saved transaction", async ({ page }) => {
    await openArchitecture(page, "PennyBloom");
    await page.getByTestId("arch-mode-engineering").click();
    await page.getByTestId("arch-node-fastapi").click();
    await expect(page.getByTestId("arch-detail")).toContainText("no business logic");
    await page.getByTestId("arch-flow").filter({ hasText: "Save a transaction" }).click();
    await expect(page.getByTestId("arch-node-store")).toHaveAttribute("data-on", "true");
    await expect(page.getByTestId("arch-node-reports")).toHaveAttribute("data-dim", "true");
  });

  test("Engineering Connections lists it for its real skills only", async ({ page }) => {
    await page.goto("/#engineering-connections");
    await page.getByText("View the connections as a table").click();
    const row = (label: string) =>
      page
        .getByTestId("connections-table")
        .locator("tr", { has: page.getByRole("rowheader", { name: label, exact: true }) });
    await expect(row("FastAPI")).toContainText("PennyBloom");
    await expect(row("SQLite")).not.toContainText("PennyBloom");
  });

  test("the Command Centre opens it", async ({ page }) => {
    await page.goto("/");
    await openNexus(page);
    await page.getByTestId("nexus-input").fill("pennybloom");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "PennyBloom" })).toBeVisible();
  });
});

test.describe("page integration", () => {
  test("loading a new section's hash puts both indicators on it", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const [hash, label] of [
      ["about", "About"],
      ["evidence", "Evidence"],
      ["ai-lab", "AI Lab"],
    ]) {
      await page.goto(`/#${hash}`);
      await expect(page.locator(`#${hash} h2`)).toBeInViewport();
      await expect(page.getByTestId("scene-rail")).toHaveAttribute("data-active-scene", hash!);
      await expect(
        page
          .getByRole("navigation", { name: "Primary", exact: true })
          .locator("[aria-current=location]"),
      ).toContainText(label!);
    }
  });

  test("the header stays on one line at tablet width", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Primary", exact: true });
    await expect(nav).toBeVisible();
    const height = await nav.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeLessThanOrEqual(60);
    await noHorizontalOverflow(page);
  });

  for (const width of [320, 390, 768, 1280, 1920]) {
    test(`no page overflow with the new features open at ${width}px`, async ({ page }) => {
      const errors = watchErrors(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/#evidence");
      await noHorizontalOverflow(page);
      await page.getByTestId("evidence-capability-ocr").click();
      await noHorizontalOverflow(page);
      await page.goto("/#ai-lab");
      for (const id of [
        "rag",
        "llm-evaluation",
        "nlp",
        "recommendation",
        "data-analytics",
        "queue",
        "ocr",
      ]) {
        await page.getByTestId(`lab-tab-${id}`).click();
        await expect(page.getByTestId("lab-panel")).toHaveAttribute("data-module", id);
        await noHorizontalOverflow(page);
      }
      await openNexus(page);
      const panel = (await page.locator(".nexus-panel").boundingBox())!;
      expect(panel.x + panel.width).toBeLessThanOrEqual(width);
      expect(panel.y + panel.height).toBeLessThanOrEqual(900);
      await page.getByTestId("nexus-close").click();
      await page.goto("/#projects");
      const study = await openCase(page, "Wingman AI");
      const box = (await page.locator("dialog[open] .case-dialog-panel").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      await study.getByRole("button", { name: "Explore architecture of Wingman AI" }).click();
      const arch = (await page.locator(".arch-panel").boundingBox())!;
      expect(arch.x + arch.width).toBeLessThanOrEqual(width);
      expect(errors).toEqual([]);
    });
  }

  test("every feature works with reduced motion", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();
    await page.goto("/#ai-lab");
    await hydrated(page);
    await page.getByTestId("lab-stage-retrieval").click();
    await expect(page.getByTestId("lab-stage-panel")).toContainText("Top 3 entries");
    await expect(page.locator(".lab-packet")).toHaveCount(0);

    await page.goto("/#evidence");
    await page.getByTestId("evidence-capability-ocr").click();
    await expect(page.getByTestId("evidence-record")).toHaveAttribute("data-record", "ocr");

    await openNexus(page);
    await page.getByTestId("nexus-input").fill("studyforge");
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "StudyForge AI" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await context.close();
  });

  test("Contact shows the form, and no email address or resume", async ({ page }) => {
    await page.goto("/#contact");
    const contact = page.locator("#contact");
    await expect(contact.getByTestId("contact-form")).toBeVisible();
    await expect(contact.locator("a[href^='mailto:']")).toHaveCount(0);
    expect(personalEmails(await contact.innerText())).toEqual([]);
    await expect(contact.getByRole("link", { name: /resume/i })).toHaveCount(0);
  });

  test("no phone number, and no console errors, across the explorers", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(page.locator("main")).toBeVisible();
    await runCommand(page, "EXPLORE GIFTBRO AI");
    await page.getByTestId("arch-mode-engineering").click();
    await page.getByTestId("arch-node-gemini").click();
    expect(contactDetails(await page.content())).toEqual([]);
    expect(errors).toEqual([]);
  });

  for (const width of [1280, 390]) {
    test(`no accessibility violations in the new features at ${width}px`, async ({ page }) => {
      test.slow(); // It audits every new feature in turn.
      await page.setViewportSize({ width, height: 900 });
      const audit = async (selector: string) => {
        const { violations } = await new AxeBuilder({ page }).include(selector).analyze();
        expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      };
      // Each section is audited once it has settled: a scene is translucent while it enters.
      const settled = async (hash: string) => {
        await page.goto(`/#${hash}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1200);
      };
      await settled("about");
      await audit(".ab-opening");
      for (const id of ["engineering-perspective", "build-process", "engineering-connections"]) {
        await page.getByTestId(id).scrollIntoViewIfNeeded();
        await page.waitForTimeout(1200);
        await audit(`[data-testid="${id}"]`);
      }
      await settled("evidence");
      await audit("#evidence");
      await settled("ai-lab");
      await audit(".lab");
      await page.getByTestId("lab-tab-queue").click();
      await page.waitForTimeout(500);
      await audit(".lab");

      await settled("projects");
      const study = await openCase(page, "Wingman AI");
      await page.waitForTimeout(700); // The morph has finished; audit it at rest.
      await audit("dialog[open]");
      await study.getByRole("button", { name: "Explore architecture of Wingman AI" }).click();
      await page.getByTestId("arch-mode-engineering").click();
      await page.getByTestId("arch-node-rag").click();
      await page.waitForTimeout(500); // The detail panel fades in; audit it at rest.
      await audit(".arch-panel");
      await page.getByTestId("architecture-close").click();
      await expect(page.getByTestId("architecture-dialog")).toBeHidden();
      await page.keyboard.press("Escape");
      await expect(study).toHaveCount(0);

      await openNexus(page);
      await page.waitForTimeout(500);
      await audit(".nexus-panel");
    });
  }
});
