import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "api",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json"],
      include: ["lib/**", "routers/**", "*.ts"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/__tests__/**",
        "**/node_modules/**",
        "**/dist/**",
      ],
    },
  },
});
