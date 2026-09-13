import path from "node:path";
import fs from "node:fs";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { prisma } from "./db";
import { usersRouter } from "./routes/users";
import { webhooksRouter } from "./routes/webhooks";
import { ticketsRouter } from "./routes/tickets";
import { metricsRouter } from "./routes/metrics";
import { setupClassificationQueue } from "./queue/classification";
import { setupAutoResolveQueue } from "./queue/auto-resolve";
import { Sentry } from "./lib/sentry";
import { error } from "console";

process.on("uncaughtException", (err) => {
  Sentry.captureException(err);
  console.error("uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
  console.error("unhandledRejection:", reason);
});

const app = express();
// Behind Railway's (or any) reverse proxy: needed for secure cookies and
// correct req.ip (rate limiting) to work.
app.set("trust proxy", 1);
const port = process.env.PORT ?? 3001;

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "ok", db: "unreachable" });
  }
});

app.use("/api/users", usersRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/tickets", ticketsRouter);
app.use("/api/metrics", metricsRouter);

// Serve the built client (client/dist) when present, so the API and the SPA
// share one origin in production — no CORS or authClient baseURL config
// needed. In dev, client/dist doesn't exist (Vite serves the client itself
// on :5173 via its own proxy), so this block is skipped entirely.
const clientDist = path.join(import.meta.dirname, "../../client/dist");
if (fs.existsSync(path.join(clientDist, "index.html"))) {
  app.use(express.static(clientDist));
  app.get("/*splat", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

Sentry.setupExpressErrorHandler(app);

// Producer only — open the pg-boss connection and ensure the queues exist so the
// webhook can enqueue jobs. The handlers live in a separate process
// (src/worker.ts) so `bun --watch` reloads here don't kill in-flight jobs.
Promise.all([setupClassificationQueue(), setupAutoResolveQueue()]).catch(
  (err) => {
    Sentry.captureException(err);
    console.error(
      "failed to start job queue producer; job enqueue will fail:",
      err,
    );
  },
);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
