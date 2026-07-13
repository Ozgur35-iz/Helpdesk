import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";

// This endpoint is a machine-to-machine webhook (shared-secret auth via `x-webhook-secret`,
// no session/cookies involved - see server/src/routes/webhooks.ts), so these tests talk to
// the server directly rather than going through the client's browser context or its Vite
// proxy. `playwright.config.ts`'s `baseURL` points at the client (port 5174); the server
// under test here runs on SERVER_PORT (3002, see server/.env.test) regardless.
const SERVER_PORT = 3002;
const SERVER_URL = `http://localhost:${SERVER_PORT}`;
const WEBHOOK_PATH = "/api/webhooks/inbound-email";

// Matches INBOUND_EMAIL_SECRET in server/.env.test, used by the test-DB server instance.
const VALID_SECRET = "test-inbound-email-secret";

function uniqueEmailPayload() {
  const id = randomUUID().slice(0, 8);
  return {
    from: `e2e-sender-${id}@example.com`,
    senderName: `E2E Sender ${id}`,
    subject: `E2E Test Subject ${id}`,
    body: "This is the body of an e2e test inbound email.",
  };
}

test.describe("Inbound email webhook (POST /api/webhooks/inbound-email)", () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    api = await playwrightRequest.newContext({ baseURL: SERVER_URL });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("rejects requests with no secret header", async () => {
    const res = await api.post(WEBHOOK_PATH, {
      data: uniqueEmailPayload(),
    });

    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("rejects requests with a wrong secret", async () => {
    const res = await api.post(WEBHOOK_PATH, {
      headers: { "x-webhook-secret": "definitely-not-the-secret" },
      data: uniqueEmailPayload(),
    });

    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  test("rejects a correctly-authenticated request missing a required field", async () => {
    const payload = uniqueEmailPayload();
    // Omit `subject`, a required field.
    const { subject: _subject, ...incompletePayload } = payload;

    const res = await api.post(WEBHOOK_PATH, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: incompletePayload,
    });

    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty("error");
    expect(typeof json.error).toBe("string");
  });

  test("rejects a correctly-authenticated request with a missing senderName", async () => {
    const payload = uniqueEmailPayload();
    const { senderName: _senderName, ...incompletePayload } = payload;

    const res = await api.post(WEBHOOK_PATH, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: incompletePayload,
    });

    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty("error");
  });

  test("creates a ticket for a valid, correctly-authenticated request", async () => {
    const payload = uniqueEmailPayload();

    const res = await api.post(WEBHOOK_PATH, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: payload,
    });

    expect(res.status()).toBe(201);
    const json = await res.json();
    expect(json).toHaveProperty("id");
    expect(typeof json.id).toBe("number");
  });

  test("is idempotent: replaying the same messageId returns the original ticket id without creating a duplicate", async () => {
    const payload = { ...uniqueEmailPayload(), messageId: `e2e-msg-${randomUUID()}` };

    const firstRes = await api.post(WEBHOOK_PATH, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: payload,
    });
    expect(firstRes.status()).toBe(201);
    const firstJson = await firstRes.json();

    // Replay with the same messageId but otherwise-different content - only messageId
    // should matter for de-duplication.
    const secondRes = await api.post(WEBHOOK_PATH, {
      headers: { "x-webhook-secret": VALID_SECRET },
      data: { ...payload, subject: `${payload.subject} (replay)` },
    });

    expect(secondRes.status()).toBe(200);
    const secondJson = await secondRes.json();
    expect(secondJson.id).toBe(firstJson.id);
  });
});
