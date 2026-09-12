// Background ticket worker. Runs as its own process (no --watch) so that reloads
// of the HTTP server never kill an in-flight job. Handles two pg-boss queues,
// each in its own module: classification and KB auto-resolution. See
// server/CLAUDE.md ("Automatic classification" / "Automatic KB auto-resolution")
// for the producer/worker split.
//
// NOTE: this process does NOT hot-reload. After editing this file, anything under
// src/queue/, src/lib/classify.ts, or src/lib/auto-resolve.ts, restart the dev
// stack for changes to take effect.
import { Sentry } from "./lib/sentry";
import { stopQueue } from "./queue";
import { workClassificationQueue, TICKET_CLASSIFICATION_QUEUE } from "./queue/classification";
import { workAutoResolveQueue, TICKET_AUTORESOLVE_QUEUE } from "./queue/auto-resolve";

process.on("uncaughtException", (err) => {
  Sentry.captureException(err);
  console.error("uncaughtException:", err);
});
process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
  console.error("unhandledRejection:", reason);
});

await Promise.all([workClassificationQueue(), workAutoResolveQueue()]);
console.log(
  `Worker started; processing "${TICKET_CLASSIFICATION_QUEUE}" and "${TICKET_AUTORESOLVE_QUEUE}" jobs`,
);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received; draining active jobs...`);

  // Hard cap so a wedged shutdown can't hang the process forever.
  const kill = setTimeout(() => {
    console.error("shutdown timed out, forcing exit");
    process.exit(1);
  }, 35_000);
  kill.unref();

  try {
    await stopQueue();
    console.log("worker stopped cleanly");
    process.exit(0);
  } catch (err) {
    console.error("error during worker shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
