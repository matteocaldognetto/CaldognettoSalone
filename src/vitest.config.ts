import { defineConfig } from "vitest/config";

/**
 * Vitest configuration.
 *
 * Uses test.projects to define workspaces explicitly.
 * E2E tests (Playwright) are excluded — run them via `bun e2e`.
 *
 * @see https://vitest.dev/guide/workspace
 */
export default defineConfig({
  test: {
    projects: [
      "apps/app/vite.config.ts",
      "apps/api/vitest.config.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
    ],
  },
});
