import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { parseBody } from "../lib/validate";
import { enqueueClassification } from "../queue/classification";
import { enqueueAutoResolve } from "../queue/auto-resolve";

const inboundEmailSchema = z.object({
  from: z.email("Enter a valid email"),
  senderName: z.string().min(1, "Sender name is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  messageId: z.string().optional(),
});

export const webhooksRouter = Router();

webhooksRouter.post("/inbound-email", async (req, res) => {
  const secret = req.header("x-webhook-secret");
  if (!secret || secret !== process.env.INBOUND_EMAIL_SECRET) {
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
