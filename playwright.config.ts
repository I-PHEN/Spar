import { defineConfig, devices } from "@playwright/test";

/**
 * Deterministic Chromium harness for the Spar voice loop.
 *
 * The project dev server on port 3000 belongs to the operator and is never
 * touched: every run owns its server on port 3100. Browser doubles replace
 * the microphone, WebSockets, audio output, and same-origin API fetches, so
 * the suite makes no model, speech, or provider request.
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    permissions: ["microphone"],
  },
  webServer: {
    command: `bunx next dev -p ${PORT}`,
    url: `${BASE_URL}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { ...process.env, SPAR_E2E_DIST: ".next-e2e" } as Record<string, string>,
    stdout: "ignore",
    stderr: "pipe",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
