import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 *
 * USAGE:
 * Option 1 (Recommended for local dev):
 *   Start servers manually first: `bun dev` from project root
 *   Then run tests: `bun e2e`
 *
 * Option 2 (CI or fresh start):
 *   Just run: `bun e2e` - Playwright will start servers automatically
 *   Note: This requires database to be running (docker compose up -d postgres)
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 3,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ...(process.env.CI
      ? [["junit", { outputFile: "results/junit.xml" }] as const]
      : []),
  ],
  outputDir: "test-results",

  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  use: {
    baseURL: "http://localhost:5173",
    trace: "off",
    screenshot: "off",
    video: "off",
  },

  // Webserver configuration
  // reuseExistingServer: true means if servers are already running, Playwright uses them
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "bun run dev",
          url: "http://localhost:8787/health",
          reuseExistingServer: true,
          cwd: "..",
          timeout: 60000,
          stdout: "pipe",
          stderr: "pipe",
        },
      ],
});
