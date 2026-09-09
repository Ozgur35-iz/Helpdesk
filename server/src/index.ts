import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth";
import { prisma } from "./db";
import { usersRouter } from "./routes/users";
import { webhooksRouter } from "./routes/webhooks";
import { ticketsRouter } from "./routes/tickets";
import { setupClassificationQueue } from "./queue/classification";
import { setupAutoResolveQueue } from "./queue/auto-resolve";

const app = express();
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

// Producer only — open the pg-boss connection and ensure the queues exist so the
// webhook can enqueue jobs. The handlers live in a separate process
// (src/worker.ts) so `bun --watch` reloads here don't kill in-flight jobs.
Promise.all([setupClassificationQueue(), setupAutoResolveQueue()]).catch((err) => {
  console.error("failed to start job queue producer; job enqueue will fail:", err);
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
