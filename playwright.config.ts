import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests of the V0.1 definition of done, on a production build in
 * demo mode (no Supabase env vars). Run: npm run build && npm run test:e2e
 * Set PLAYWRIGHT_CHROMIUM_PATH to use an existing Chromium instead of
 * `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    ...devices["Pixel 7"],
    baseURL: "http://localhost:3130",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: "npx next start -p 3130",
    url: "http://localhost:3130/nizar",
    reuseExistingServer: false,
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
  },
});
