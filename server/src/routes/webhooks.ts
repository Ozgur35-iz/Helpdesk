import { timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { parseBody } from "../lib/validate";
import { webhookRouteLimiter } from "../lib/rateLimit";
import { enqueueClassification } from "../queue/classification";
import { enqueueAutoResolve } from "../queue/auto-resolve";

const inboundEmailSchema = z.object({
  from: z.email("Enter a valid email").max(320),
  senderName: z.string().min(1, "Sender name is required").max(200),
  subject: z.string().min(1, "Subject is required").max(500),
  body: z.string().min(1, "Body is required").max(20_000),
  messageId: z.string().max(500).optional(),
});

export const webhooksRouter = Router();

function isValidWebhookSecret(provided: string | undefined): boolean {
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on mismatched lengths, so guard that first — this
  // still reveals length via timing, but never the secret's content.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

webhooksRouter.post("/inbound-email", webhookRouteLimiter, async (req, res) => {
  if (!isValidWebhookSecret(req.header("x-webhook-secret"))) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const data = parseBody(inboundEmailSchema, req.body, res);
  if (!data) return;
  const { from, senderName, subject, body, messageId } = data;

  if (messageId) {
    const existing = await prisma.ticket.findUnique({ where: { externalMessageId: messageId } });
    if (existing) {
      res.status(200).json({ id: existing.id });
      return;
    }
  }

  const ticket = await prisma.ticket.create({
    data: { subject, body, requesterEmail: from, senderName, externalMessageId: messageId },
  });

  // Enqueue the AI jobs instead of running them inline; the webhook response must
  // never block on (or fail over) Gemini. A queue hiccup just leaves the ticket
  // at category: null / status: "new" for an agent to pick up manually.
  try {
    await enqueueClassification(ticket.id);
    await enqueueAutoResolve(ticket.id);
  } catch (err) {
    console.error(`failed to enqueue AI jobs for ticket ${ticket.id}:`, err);
  }

  res.status(201).json({ id: ticket.id });
});
