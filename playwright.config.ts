import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e", workers: 1, fullyParallel: false, timeout: 120_000,
  expect: { timeout: 20_000 },
  use: { baseURL: "http://localhost:5173", browserName: "chromium", trace: "off", screenshot: "only-on-failure" },
  // Traces can contain burner/session state. Do not record or publish them by default.
  webServer: { command: "node scripts/local-demo.mjs", url: "http://localhost:5173", timeout: 120_000, reuseExistingServer: false },
});
