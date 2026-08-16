import process from "node:process";
import { defineConfig } from "@playwright/test";

const ci = !!process.env.CI;

export default defineConfig({
  testDir: "./tests",
  timeout: 15_000,
  workers: ci ? 2 : 4,
  fullyParallel: true,
  retries: ci ? 1 : 0,
  reporter: [["list"]],
  // The landing page server is managed by start-server-and-test in the npm
  // script.  Keeping the lifecycle out of Playwright prevents orphaned
  // servers from poisoning subsequent runs when a test run crashes.
  use: {
    trace: "retain-on-failure",
  },
});
