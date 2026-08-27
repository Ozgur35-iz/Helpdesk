import { PgBoss } from "pg-boss";
import { classifyTicketById } from "./lib/classify";

export const TICKET_CLASSIFICATION_QUEUE = "ticket-classification";

export type TicketClassificationJob = { ticketId: number };

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required for the job queue (pg-boss)");
}

// pg-boss keeps its own bookkeeping tables in a dedicated `pgboss` schema,
// separate from the Prisma-managed application tables in `public`. `start()`
// creates/migrates that schema on first run.
export const boss = new PgBoss({ connectionString, schema: "pgboss" });

boss.on("error", (err) => {
  console.error("pg-boss error:", err);
});

let starting: Promise<void> | null = null;

// Idempotent: boots pg-boss, ensures the queue exists, and registers the worker.
// Called from the server entrypoint (src/index.ts); safe to call more than once.
export function startQueue(): Promise<void> {
  if (!starting) {
    starting = (async () => {
      await boss.start();
      await boss.createQueue(TICKET_CLASSIFICATION_QUEUE, {
        retryLimit: 3,
        retryBackoff: true,
      });
      await boss.work<TicketClassificationJob>(
        TICKET_CLASSIFICATION_QUEUE,
        async ([job]) => {
          await classifyTicketById(job.data.ticketId);
        },
      );
    })();
  }
  return starting;
}
