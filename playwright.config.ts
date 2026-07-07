import { defineConfig, devices } from "@playwright/test";

const SERVER_PORT = 3002;
const CLIENT_PORT = 5174;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun run test:server",
      cwd: "./server",
      port: SERVER_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "bun run dev -- --port 5174",
      cwd: "./client",
      port: CLIENT_PORT,
      env: { VITE_SERVER_PORT: String(SERVER_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
