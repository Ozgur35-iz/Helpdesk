import { test as setup, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./storage-state";

// Seeded by `bun run test:e2e:setup` from server/.env.test (ADMIN_EMAIL / ADMIN_PASSWORD).
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "password123";

// Runs once (as the "setup" Playwright project) before specs that depend on it, logging
// in as the seeded admin via the real login UI and persisting the resulting session so
// other specs can start already-authenticated via `test.use({ storageState: ... })`
// instead of repeating the login flow themselves.
setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
