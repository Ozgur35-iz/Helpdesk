import { PgBoss } from "pg-boss";
import { Sentry } from "../lib/sentry";

// Shared pg-boss connection. Each feature owns its own queue module next to this
// one — `./classification` and `./auto-resolve` — which import `boss` /
// `connectQueue` from here to create their queue, enqueue jobs, and (in the
// worker process) register their handler.

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for the job queue (pg-boss)");
}

// pg-boss keeps its own bookkeeping tables in a dedicated `pgboss` schema,
// separate from the Prisma-managed application tables in `public`. `start()`
// creates/migrates that schema on first run.
export const boss = new PgBoss({ connectionString, schema: "pgboss" });

boss.on("error", (err) => {
  Sentry.captureException(err);
  console.error("pg-boss error:", err);
});

let ready: Promise<void> | null = null;

// Opens the pg-boss connection. Idempotent per process; every queue module calls
// it before creating its queue or registering its handler.
export function connectQueue(): Promise<void> {
  if (!ready) {
    ready = boss.start().then(() => undefined);
  }
  return ready;
}

// Graceful shutdown: stop polling and wait (up to 30s) for the active job to
// finish before closing the pool, so a job isn't orphaned in `active` state.
// Resolves once pg-boss has fully stopped.
export function stopQueue(): Promise<void> {
  return new Promise((resolve, reject) => {
    boss.once("stopped", () => resolve());
    boss.stop({ graceful: true, timeout: 30_000 }).catch(reject);
  });
}
