import { expect, test as base, type Page } from "@playwright/test";

/** The scene rail is measured on mount, so its marker shows the page has hydrated. */
export const hydrated = (page: Page) =>
  expect(page.getByTestId("scene-rail")).toHaveAttribute("data-measured", "true");

/**
 * Every navigation waits for hydration. Before it, a click on a server-rendered control does
 * nothing, and Next's router can still rewrite the URL, which makes tests fail at random under load.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    const goto = page.goto.bind(page);
    page.goto = async (...args) => {
      const response = await goto(...args);
      await hydrated(page);
      return response;
    };
    await provide(page);
  },
});

export { expect };
export type { Page };
