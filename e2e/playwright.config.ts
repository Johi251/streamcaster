import { defineConfig, type PlaywrightTestOptions } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";
const SIGNALING = process.env.E2E_SIGNALING_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "./specs",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE,
    headless: true,
    // Full Chromium (channel "chromium") — the headless shell lacks
    // getUserMedia/getDisplayMedia support.
    channel: "chromium",
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      args: [
        "--autoplay-policy=no-user-gesture-required",
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--mute-audio",
      ],
    },
  },
  projects: [{ name: "chromium-desktop", use: { browserName: "chromium" } as PlaywrightTestOptions }],
  // Servers are managed OUTSIDE Playwright for determinism — see
  // e2e/local-setup.md (static server + two `wrangler dev` instances).
  // CI/deployed runs: point E2E_BASE_URL at the Pages URL, no local servers.
});
