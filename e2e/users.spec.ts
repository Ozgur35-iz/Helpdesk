import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { ADMIN_STORAGE_STATE } from "./storage-state";

// Seeded by `bun run test:e2e:setup` from server/.env.test (ADMIN_EMAIL / ADMIN_PASSWORD).
const ADMIN_EMAIL = "admin@example.com";

// This page is admin-only (`RequireAdmin`), so every test here runs as the seeded admin
// via the pre-authenticated storage state produced by `e2e/auth.setup.ts`.
test.use({ storageState: ADMIN_STORAGE_STATE });

// The initial load shows a skeleton for a minimum of 2s (see UsersPage's
// MIN_SKELETON_MS) before real rows render, so the first assertion after navigating
// needs more headroom than Playwright's default 5s expect timeout.
const FIRST_LOAD_TIMEOUT = 10_000;

function uniqueUser() {
  const id = randomUUID().slice(0, 8);
  return {
    name: `E2E Test User ${id}`,
    email: `e2e-user-${id}@example.com`,
    password: "hunter2pass",
  };
}

function rowFor(page: Page, text: string) {
  return page.getByRole("row").filter({ hasText: text });
}

/** Creates a user through the real Create User modal and waits for its row to land in the table. */
async function createUserViaUI(
  page: Page,
  user: { name: string; email: string; password: string },
) {
  await page.getByRole("button", { name: "Create User" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Create User" })).toBeVisible();

  await dialog.getByLabel("Name").fill(user.name);
  await dialog.getByLabel("Email").fill(user.email);
  await dialog.getByLabel("Password").fill(user.password);
  await dialog.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rowFor(page, user.email)).toBeVisible();
}

test.describe("User management (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/users");
    // Wait out the initial skeleton so subsequent row lookups aren't racing it.
    await expect(rowFor(page, ADMIN_EMAIL)).toBeVisible({ timeout: FIRST_LOAD_TIMEOUT });
  });

  test("lists the existing users (Read)", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();

    const adminRow = rowFor(page, ADMIN_EMAIL);
    await expect(adminRow).toBeVisible();
    await expect(adminRow.getByText("admin", { exact: true })).toBeVisible();
    // Seeded admin can't be deleted - covered here as an observed row property, not a
    // separate permission test.
    await expect(adminRow.getByRole("button", { name: /^Delete/ })).toBeDisabled();
  });

  test("creates a user via the form and it appears in the list (Create)", async ({ page }) => {
    const user = uniqueUser();

    await createUserViaUI(page, user);

    const row = rowFor(page, user.email);
    await expect(row.getByText(user.name)).toBeVisible();
    await expect(row.getByText("agent", { exact: true })).toBeVisible();
  });

  test("edits a user's name and email and the change is reflected in the list (Update)", async ({
    page,
  }) => {
    const original = uniqueUser();
    await createUserViaUI(page, original);

    await page.getByRole("button", { name: `Edit ${original.name}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Edit User" })).toBeVisible();
    await expect(dialog.getByLabel("Name")).toHaveValue(original.name);
    await expect(dialog.getByLabel("Email")).toHaveValue(original.email);

    const updated = uniqueUser();
    await dialog.getByLabel("Name").fill("");
    await dialog.getByLabel("Name").fill(updated.name);
    await dialog.getByLabel("Email").fill("");
    await dialog.getByLabel("Email").fill(updated.email);
    await dialog.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(rowFor(page, updated.email).getByText(updated.name)).toBeVisible();
    await expect(rowFor(page, original.email)).toHaveCount(0);
  });

  test("deletes a user via the confirmation modal and it disappears from the list (Delete)", async ({
    page,
  }) => {
    const user = uniqueUser();
    await createUserViaUI(page, user);

    await page.getByRole("button", { name: `Delete ${user.name}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Delete User" })).toBeVisible();
    await expect(dialog.getByText(user.name)).toBeVisible();

    await dialog.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(rowFor(page, user.email)).toHaveCount(0);
  });
});
