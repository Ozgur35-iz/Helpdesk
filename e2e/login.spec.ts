import { test, expect, type Page } from "@playwright/test";

// Seeded by `bun run test:e2e:setup` from server/.env.test (ADMIN_EMAIL / ADMIN_PASSWORD).
// There is currently no way to create a second/non-admin ("agent") user through any
// API, so all authenticated scenarios below necessarily use this one admin account.
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "password123";

const SIGN_IN_ENDPOINT = "**/api/auth/sign-in/email";

function trackSignInRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/auth/sign-in/email")) urls.push(req.url());
  });
  return urls;
}

async function fillLoginForm(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
}

test.describe("Login page - structure & accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders a heading, labeled email/password fields, and a submit button", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();

    const email = page.getByLabel("Email");
    const password = page.getByLabel("Password");
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute("type", "email");
    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute("type", "password");

    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  });

  test("email and password labels are programmatically associated with their inputs", async ({
    page,
  }) => {
    // getByLabel only succeeds if the <label> is properly associated (via htmlFor/id
    // or wrapping) with the control, so a successful, unambiguous match here is itself
    // the accessibility assertion.
    await expect(page.getByLabel("Email", { exact: true })).toHaveCount(1);
    await expect(page.getByLabel("Password", { exact: true })).toHaveCount(1);
  });

  test("shows no error alert on initial load", async ({ page }) => {
    await expect(page.getByRole("alert")).toHaveCount(0);
  });
});

test.describe("Login page - client-side validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("submitting with both fields empty shows both validation errors and makes no network call", async ({
    page,
  }) => {
    const signInRequests = trackSignInRequests(page);

    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    // Still on the login page, and no auth request was ever issued.
    await expect(page).toHaveURL(/\/login$/);
    expect(signInRequests).toHaveLength(0);
  });

  test("submitting with only email empty shows just the email error", async ({ page }) => {
    const signInRequests = trackSignInRequests(page);

    await page.getByLabel("Password").fill("somepassword");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Enter a valid email")).toBeVisible();
    await expect(page.getByText("Password is required")).not.toBeVisible();
    expect(signInRequests).toHaveLength(0);
  });

  test("submitting with only password empty shows just the password error", async ({ page }) => {
    const signInRequests = trackSignInRequests(page);

    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Password is required")).toBeVisible();
    await expect(page.getByText("Enter a valid email")).not.toBeVisible();
    expect(signInRequests).toHaveLength(0);
  });

  for (const badEmail of ["plainaddress", "missing-at.example.com", "foo@", "foo@bar"]) {
    test(`rejects malformed email "${badEmail}" with a validation error`, async ({ page }) => {
      const signInRequests = trackSignInRequests(page);

      await fillLoginForm(page, badEmail, "somepassword");
      await page.getByRole("button", { name: "Log in" }).click();

      await expect(page.getByText("Enter a valid email")).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
      expect(signInRequests).toHaveLength(0);
    });
  }

  test("whitespace-only email is treated as invalid (not merely empty)", async ({ page }) => {
    const signInRequests = trackSignInRequests(page);

    await fillLoginForm(page, "   ", "somepassword");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Enter a valid email")).toBeVisible();
    expect(signInRequests).toHaveLength(0);
  });

  test("whitespace-only password passes client-side validation (min length 1) and reaches the server", async ({
    page,
  }) => {
    const signInRequests = trackSignInRequests(page);

    await fillLoginForm(page, ADMIN_EMAIL, " ");
    await page.getByRole("button", { name: "Log in" }).click();

    // Not a client-side "Password is required" error - it actually gets submitted...
    await expect(page.getByRole("alert")).toBeVisible();
    expect(signInRequests.length).toBeGreaterThan(0);
    // ...and, as expected, a whitespace password does not match the real one.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("validation error clears live once the field is corrected after a failed submit", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByText("Enter a valid email")).toBeVisible();

    await page.getByLabel("Email").fill("valid@example.com");
    await expect(page.getByText("Enter a valid email")).not.toBeVisible();
  });
});

test.describe("Login page - authentication", () => {
  test("logs in successfully with the seeded admin credentials and redirects to /", async ({
    page,
  }) => {
    await page.goto("/login");
    await fillLoginForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);
    await expect(page.getByRole("heading", { name: /welcome, admin/i })).toBeVisible();
  });

  test("wrong password for a real account shows a generic error and stays on /login", async ({
    page,
  }) => {
    await page.goto("/login");
    await fillLoginForm(page, ADMIN_EMAIL, "definitely-the-wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toHaveText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("non-existent email shows the same generic error as a wrong password (no user-enumeration leak)", async ({
    page,
  }) => {
    await page.goto("/login");
    await fillLoginForm(page, "no-such-user@example.com", "whatever-password");
    await page.getByRole("button", { name: "Log in" }).click();

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    const nonExistentMessage = await alert.textContent();

    // Reload and compare against the wrong-password message for the same real account.
    await page.goto("/login");
    await fillLoginForm(page, ADMIN_EMAIL, "definitely-the-wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();
    const wrongPasswordMessage = await page.getByRole("alert").textContent();

    expect(nonExistentMessage).toBe(wrongPasswordMessage);
    expect(nonExistentMessage?.toLowerCase()).not.toContain("not found");
    expect(nonExistentMessage?.toLowerCase()).not.toContain("no user");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("entered email is preserved after a failed login attempt", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, ADMIN_EMAIL, "wrong-password-again");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(ADMIN_EMAIL);
  });

  test("submitting via Enter key from the password field logs in successfully", async ({
    page,
  }) => {
    await page.goto("/login");
    await fillLoginForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.getByLabel("Password").press("Enter");

    await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);
  });
});

test.describe("Login page - loading state", () => {
  test("disables the submit button and shows 'Logging in...' while the request is in flight", async ({
    page,
  }) => {
    await page.route(SIGN_IN_ENDPOINT, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.goto("/login");
    await fillLoginForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Note: don't filter by accessible name here - the button's label changes to
    // "Logging in..." while pending, which would no longer match a "log in" name filter.
    const button = page.getByRole("button");
    await button.click();

    await expect(button).toHaveText("Logging in...");
    await expect(button).toBeDisabled();

    // Eventually resolves and navigates away once the (delayed) response arrives.
    await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);
  });
});

test.describe("Login page - route guards", () => {
  test("an authenticated session visiting /login is redirected to /", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);

    // Now that the session is established in this browser context, going back to
    // /login should bounce straight back to / via GuestOnly.
    await page.goto("/login");
    await expect(page).toHaveURL(/^http:\/\/localhost:5174\/$/);
  });

  test("an unauthenticated visit to / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an unauthenticated visit to /users redirects to /login", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an unauthenticated visit to an unknown route ends up on /login (via / redirect)", async ({
    page,
  }) => {
    await page.goto("/some/unknown/route");
    await expect(page).toHaveURL(/\/login$/);
  });
});
