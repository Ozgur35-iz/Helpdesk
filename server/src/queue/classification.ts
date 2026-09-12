import { boss, connectQueue } from "./index";
import { classifyTicketById } from "../lib/classify";
import { Sentry } from "../lib/sentry";

export const TICKET_CLASSIFICATION_QUEUE = "ticket-classification";

export type TicketClassificationJob = { ticketId: number };

// Producer side (HTTP server, src/index.ts): connect and ensure the queue exists
// so `enqueueClassification` can send to it. No handler is registered here.
export async function setupClassificationQueue(): Promise<void> {
  await connectQueue();
  await boss.createQueue(TICKET_CLASSIFICATION_QUEUE, {
    retryLimit: 3,
    retryBackoff: true,
  });
}

export function enqueueClassification(ticketId: number) {
  const job: TicketClassificationJob = { ticketId };
  return boss.send(TICKET_CLASSIFICATION_QUEUE, job);
}

// Worker side (src/worker.ts): create the queue, then register the handler that
// actually classifies the ticket.
export async function workClassificationQueue(): Promise<void> {
  await setupClassificationQueue();
  await boss.work<TicketClassificationJob>(
    TICKET_CLASSIFICATION_QUEUE,
    async ([job]) => {
      try {
        await classifyTicketById(job.data.ticketId);
      } catch (err) {
        Sentry.captureException(err);
        throw err;
      }
    },
  );
}
