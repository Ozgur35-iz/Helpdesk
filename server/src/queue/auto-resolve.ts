import { boss, connectQueue } from "./index";
import { autoResolveTicketById } from "../lib/auto-resolve";

export const TICKET_AUTORESOLVE_QUEUE = "ticket-auto-resolve";

export type TicketAutoResolveJob = { ticketId: number };

// Producer side (HTTP server, src/index.ts): connect and ensure the queue exists
// so `enqueueAutoResolve` can send to it. No handler is registered here.
export async function setupAutoResolveQueue(): Promise<void> {
  await connectQueue();
  await boss.createQueue(TICKET_AUTORESOLVE_QUEUE, {
    retryLimit: 3,
    retryBackoff: true,
  });
}

export function enqueueAutoResolve(ticketId: number) {
  const job: TicketAutoResolveJob = { ticketId };
  return boss.send(TICKET_AUTORESOLVE_QUEUE, job);
}

// Worker side (src/worker.ts): create the queue, then register the handler that
// runs the KB auto-resolve pass.
export async function workAutoResolveQueue(): Promise<void> {
  await setupAutoResolveQueue();
  await boss.work<TicketAutoResolveJob>(
    TICKET_AUTORESOLVE_QUEUE,
    async ([job]) => {
      await autoResolveTicketById(job.data.ticketId);
    },
  );
}
