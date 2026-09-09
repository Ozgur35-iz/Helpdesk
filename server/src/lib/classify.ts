import { generateText } from "ai";
import { prisma } from "../db";
import type { Ticket } from "../../generated/prisma/client";
import { geminiModel, aiMaxRetries } from "./ai";
import { categoryValues, type Category } from "./categories";

function isCategory(value: string): value is Category {
  return (categoryValues as readonly string[]).includes(value);
}

// Throws on an API/transport failure so the pg-boss worker retries the job. A
// well-formed but unrecognized model response is treated as terminal (logged,
// no throw) — a retry won't turn an unusable answer into a valid category.
async function classifyTicket(ticket: Ticket) {
  const { text } = await generateText({
    model: geminiModel,
    // pg-boss owns the real retry/backoff for this job; keep the SDK's short.
    maxRetries: aiMaxRetries,
    prompt:
      `Classify the support ticket below into exactly one of these categories: ${categoryValues.join(", ")}. ` +
      "Respond with only the category name in lowercase, no punctuation or explanation.\n\n" +
      `Subject: ${ticket.subject}\n\nBody:\n${ticket.body}`,
  });

  const category = text.trim().toLowerCase();
  if (!isCategory(category)) {
    console.error(`classify: model returned unrecognized category "${category}" for ticket ${ticket.id}`);
    return;
  }

  await prisma.ticket.update({ where: { id: ticket.id }, data: { category } });
}

// Entry point for the ticket-classification queue worker (server/src/queue/classification.ts).
// Re-fetches the ticket so the job payload can stay a bare id and the worker
// always classifies the current row.
export async function classifyTicketById(ticketId: number) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    console.error(`classify: ticket ${ticketId} not found, skipping`);
    return;
  }
  await classifyTicket(ticket);
}
