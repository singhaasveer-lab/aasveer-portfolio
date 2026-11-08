import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PREVIEW_PORT ?? 3100);

// Development-preview journeys: runs `next dev` with PORTFOLIO_PREVIEW=1 (never a production build).
// Needs data/portfolio.db, so run `pnpm db:build` (or `pnpm build`) first.
export default defineConfig({
  testDir: "tests/e2e-preview",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  timeout: 90_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx cross-env PORTFOLIO_PREVIEW=1 next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
