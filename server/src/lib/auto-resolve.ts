import { generateObject } from "ai";
import { z } from "zod";
import { prisma } from "../db";
import type { Ticket } from "../../generated/prisma/client";
import { geminiModel, aiMaxRetries } from "./ai";

// The support knowledge base drives the auto-resolve decision. It's a static
// asset shipped next to the server package; read it once and cache the promise.
const knowledgeBaseUrl = new URL("../../knowledge-base.md", import.meta.url);
let knowledgeBasePromise: Promise<string> | null = null;
function loadKnowledgeBase(): Promise<string> {
  if (!knowledgeBasePromise) {
    knowledgeBasePromise = Bun.file(knowledgeBaseUrl).text();
  }
  return knowledgeBasePromise;
}

const decisionSchema = z.object({
  canResolve: z.boolean(),
  reply: z.string(),
  reason: z.string(),
});

// Unlike classification, a failure here must NOT leave the ticket wedged in
// "processing" (invisible to agents): on any error we hand the ticket to a human
// by moving it to "open". So this never throws — pg-boss has nothing to retry.
async function autoResolveTicket(ticket: Ticket) {
  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "processing" } });

  try {
    const knowledgeBase = await loadKnowledgeBase();
    const { object } = await generateObject({
      model: geminiModel,
      // Keep the SDK's own retrying short; this handler owns the fallback.
      maxRetries: aiMaxRetries,
      schema: decisionSchema,
      prompt:
        "You are a support assistant for Code with Mosh. Decide whether the incoming support " +
        "ticket can be fully and confidently resolved using ONLY the knowledge base below.\n\n" +
        "Set canResolve to false if:\n" +
        "- the knowledge base does not clearly and completely answer the ticket, or\n" +
        "- answering requires an account-specific action or data you cannot perform, or\n" +
        "- any rule in the knowledge base's \"Escalation Rules (Internal Policy)\" section " +
        "applies (legal threats, a refund requested outside the 30-day window, a chargeback or " +
        "payment dispute, an account-security concern, or low confidence).\n\n" +
        "When canResolve is true, `reply` must be a complete, friendly, customer-ready answer " +
        "grounded only in the knowledge base. When canResolve is false, `reply` may be empty. " +
        "`reason` is a one-sentence justification.\n\n" +
        `=== KNOWLEDGE BASE ===\n${knowledgeBase}\n=== END KNOWLEDGE BASE ===\n\n` +
        `Ticket subject: ${ticket.subject}\n\nTicket body:\n${ticket.body}`,
    });

    if (object.canResolve) {
      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: "resolved", aiResolutionReply: object.reply },
      });
      return;
    }

    console.log(`auto-resolve: ticket ${ticket.id} handed to an agent — ${object.reason}`);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "open" } });
  } catch (err) {
    console.error(`auto-resolve: failed for ticket ${ticket.id}, handing to an agent:`, err);
    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "open" } });
  }
}

// Entry point for the ticket-auto-resolve queue worker (server/src/queue/auto-resolve.ts).
// Re-fetches the ticket so the job payload can stay a bare id.
export async function autoResolveTicketById(ticketId: number) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    console.error(`auto-resolve: ticket ${ticketId} not found, skipping`);
    return;
  }
  // Only act on a freshly-arrived ticket. A redelivered job, or an agent who
  // already picked it up, leaves it alone.
  if (ticket.status !== "new") {
    return;
  }
  await autoResolveTicket(ticket);
}
