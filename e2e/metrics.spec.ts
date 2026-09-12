import {
  test,
  expect,
  request as playwrightRequest,
  type APIRequestContext,
} from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./storage-state";

// GET /api/metrics (server/src/routes/metrics.ts) is session-gated but open to any
// role. The seeded test DB only has the one admin user and there's no way to make an
// agent-role user, so the "any authenticated role works" path is only exercised as
// admin here.
const METRICS_PATH = "/api/metrics";

// The e2e HTTP server runs on this port (server/.env.test SERVER_PORT); the client on
// 5174 proxies /api to it. `playwright.config.ts` `baseURL` points at the client.
const SERVER_URL = "http://localhost:3002";

test.describe("Dashboard metrics (GET /api/metrics)", () => {
  test.describe("unauthenticated", () => {
    let api: APIRequestContext;

    test.beforeAll(async () => {
      // A fresh context straight at the server, with no cookies/session.
      api = await playwrightRequest.newContext({ baseURL: SERVER_URL });
    });

    test.afterAll(async () => {
      await api.dispose();
    });

    test("rejects a request with no session", async () => {
      const res = await api.get(METRICS_PATH);

      expect(res.status()).toBe(401);
      expect(await res.json()).toEqual({ error: "Unauthorized" });
    });
  });

  test.describe("authenticated as admin", () => {
    // Pre-authenticated admin session from e2e/auth.setup.ts; the `request` fixture
    // inherits this storageState (and the client baseURL, which proxies /api → 3002).
    test.use({ storageState: ADMIN_STORAGE_STATE });

    test("returns well-formed aggregate metrics", async ({ request }) => {
      const res = await request.get(METRICS_PATH);

      expect(res.status()).toBe(200);
      const body = await res.json();

      // Exact counts vary by run order (inbound-email-webhook.spec.ts creates ticket
      // rows in the same shared DB), so only assert shape and invariants.
      expect(body).toEqual({
        totalTickets: expect.any(Number),
        openTickets: expect.any(Number),
        aiResolvedTickets: expect.any(Number),
        aiResolvedPercent: expect.any(Number),
        avgResolutionSeconds: body.avgResolutionSeconds, // checked explicitly below
        ticketsPerDay: expect.any(Array),
      });

      for (const key of ["totalTickets", "openTickets", "aiResolvedTickets"] as const) {
        expect(Number.isInteger(body[key]), `${key} should be an integer`).toBe(true);
        expect(body[key]).toBeGreaterThanOrEqual(0);
      }

      expect(body.aiResolvedPercent).toBeGreaterThanOrEqual(0);
      expect(body.aiResolvedPercent).toBeLessThanOrEqual(100);

      if (body.avgResolutionSeconds !== null) {
        expect(typeof body.avgResolutionSeconds).toBe("number");
        expect(body.avgResolutionSeconds).toBeGreaterThanOrEqual(0);
      }

      // A dense 30-entry series (oldest first), one per day, zero-filled.
      expect(body.ticketsPerDay).toHaveLength(30);
      for (const point of body.ticketsPerDay) {
        expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isInteger(point.count)).toBe(true);
        expect(point.count).toBeGreaterThanOrEqual(0);
      }
      const days = body.ticketsPerDay.map((p: { date: string }) => p.date);
      expect([...days].sort()).toEqual(days);
      expect(days[days.length - 1]).toBe(new Date().toISOString().slice(0, 10));
    });
  });
});
