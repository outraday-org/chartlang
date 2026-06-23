// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { defineConfig, devices } from "@playwright/test"

// Preview on 3101 (dev is 3100) so the e2e suite can run alongside `dev`.
const PORT = 3101
const BASE_URL = `http://localhost:${PORT}`

// The eod suite cannot intercept the app's SERVER-side fetch from the browser,
// so it runs a mock Yahoo Finance server (tests/eodMockServer.ts) and points
// the app at it via YAHOO_BASE_URL. A dedicated e2e DB keeps the bars cache
// clean across `vite build` runs, so the source:"network"→"cache" assertions
// stay deterministic.
const EOD_MOCK_PORT = 4599
const EOD_MOCK_URL = `http://localhost:${EOD_MOCK_PORT}`

// Build once, then serve the production artifact. The `/api/compile` route
// runs the real compiler in the built server bundle, so the e2e suite
// gates the built output rather than the dev server.
export default defineConfig({
  testDir: "./tests",
  // Wipe the dedicated e2e DB before the run so the daily-bars cache starts
  // clean (deterministic source:"network"→"cache" assertions).
  globalSetup: "./tests/eodGlobalSetup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Mock Yahoo Finance chart API the app's server-side fetch talks to (tsx
      // runs the .ts directly). A GET to `/` returns 404 — any response tells
      // Playwright the server is up.
      command: `tsx tests/eodMockServer.ts`,
      url: `${EOD_MOCK_URL}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { EOD_MOCK_PORT: String(EOD_MOCK_PORT) },
    },
    {
      command: `vite build && vite preview --port ${PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        YAHOO_BASE_URL: EOD_MOCK_URL,
        DATABASE_URL: "file:./data/e2e.db",
      },
    },
  ],
})
