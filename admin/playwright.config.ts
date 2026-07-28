import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "e2e-results.json" }]],
  use: {
    baseURL: process.env.ADMIN_URL ?? "http://localhost:3000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
