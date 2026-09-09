import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { generateText } from "ai";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { auth } from "../auth";
import { prisma } from "../db";
import { geminiModel, aiMaxRetries } from "../lib/ai";
import { parseBody } from "../lib/validate";
import { categoryValues } from "../lib/categories";

const sortableFields = ["subject", "status", "category", "createdAt"] as const;
// A ticket row can also hold the AI-pipeline statuses "new" and "processing"
// (see server/prisma/schema.prisma). Those are hidden from the list (see the
// GET "/" handler) and can't be set or filtered by an agent.
const agentStatusValues = ["open", "pending", "resolved", "closed"] as const;
// Hidden from the ticket list while the AI KB auto-resolver is working on them.
const hiddenListStatuses = ["new", "processing"];

const ticketsQuerySchema = z.object({
  sortBy: z.enum(sortableFields).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(agentStatusValues).optional(),
  category: z.enum([...categoryValues, "none"]).optional(),
  subject: z.string().trim().min(1).optional(),
  requester: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const ticketIdParamSchema = z.object({ id: z.coerce.number().int().positive() });
const assignTicketSchema = z.object({ assigneeId: z.string().min(1).nullable() });
const updateStatusSchema = z.object({ status: z.enum(agentStatusValues) });
const updateCategorySchema = z.object({ category: z.enum(categoryValues).nullable() });
const createReplySchema = z.object({ body: z.string().trim().min(1, "Reply cannot be empty") });
const polishReplySchema = z.object({ body: z.string().trim().min(1, "Reply cannot be empty") });

export const ticketsRouter = Router();

ticketsRouter.get("/", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const query = parseBody(ticketsQuerySchema, req.query, res);
  if (!query) return;

  const where: Prisma.TicketWhereInput = {};
  // Tickets still in the AI KB auto-resolve pipeline ("new"/"processing") are
  // hidden until they land on a real status. A specific status filter is always
  // one of the agent statuses, so it already excludes them.
  where.status = query.status ?? { notIn: hiddenListStatuses };
  if (query.category) where.category = query.category === "none" ? null : query.category;
  if (query.subject) where.subject = { contains: query.subject, mode: "insensitive" };
  if (query.requester) {
    where.OR = [
      { senderName: { contains: query.requester, mode: "insensitive" } },
      { requesterEmail: { contains: query.requester, mode: "insensitive" } },
    ];
  }

  const [tickets, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: { assignee: { select: { id: true, name: true, email: true } } },
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);
  res.json({ data: tickets, total, page: query.page, pageSize: query.pageSize });
});

ticketsRouter.get("/:id", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = parseBody(ticketIdParamSchema, req.params, res);
  if (!params) return;

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.id },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  res.json(ticket);
});

ticketsRouter.patch("/:id/assign", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = parseBody(ticketIdParamSchema, req.params, res);
  if (!params) return;

  const data = parseBody(assignTicketSchema, req.body, res);
  if (!data) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (data.assigneeId) {
    const assignee = await prisma.user.findUnique({ where: { id: data.assigneeId } });
    if (!assignee || assignee.deletedAt) {
      res.status(404).json({ error: "Assignee not found" });
      return;
    }
  }

  const updated = await prisma.ticket.update({
    where: { id: params.id },
    data: { assigneeId: data.assigneeId },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  res.json(updated);
});

ticketsRouter.patch("/:id/status", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = parseBody(ticketIdParamSchema, req.params, res);
  if (!params) return;

  const data = parseBody(updateStatusSchema, req.body, res);
  if (!data) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const updated = await prisma.ticket.update({
    where: { id: params.id },
    data: { status: data.status },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  res.json(updated);
});

ticketsRouter.patch("/:id/category", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = parseBody(ticketIdParamSchema, req.params, res);
  if (!params) return;

  const data = parseBody(updateCategorySchema, req.body, res);
  if (!data) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const updated = await prisma.ticket.update({
    where: { id: params.id },
    data: { category: data.category },
    include: { assignee: { select: { id: true, name: true, email: true } } },
  });
  res.json(updated);
});

ticketsRouter.get("/:id/replies", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = parseBody(ticketIdParamSchema, req.params, res);
  if (!params) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const replies = await prisma.ticketReply.findMany({
    where: { ticketId: params.id },
    include: { author: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(replies);
});

ticketsRouter.post("/:id/summarize", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = parseBody(ticketIdParamSchema, req.params, res);
  if (!params) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const replies = await prisma.ticketReply.findMany({
    where: { ticketId: params.id },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const conversation = [
    `Original message from ${ticket.senderName}:\n${ticket.body}`,
    ...replies.map((reply) => `Reply from ${reply.author.name}:\n${reply.body}`),
  ].join("\n\n");

  try {
    const { text } = await generateText({
      model: geminiModel,
      maxRetries: aiMaxRetries,
      prompt:
        "Summarize the support ticket conversation below for an agent who needs to get up to speed quickly. " +
        "Cover the customer's issue, what has been done so far, and the current state. Keep it to 2-4 sentences. " +
        "Respond with only the summary text, no preamble or headings.\n\n" +
        `Ticket subject: ${ticket.subject}\n\n${conversation}`,
    });
    res.json({ text: text.trim() });
  } catch (err) {
    console.error("summarize failed:", err);
    res.status(502).json({ error: "Failed to summarize ticket" });
  }
});

ticketsRouter.post("/:id/polish-reply", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = parseBody(ticketIdParamSchema, req.params, res);
  if (!params) return;

  const data = parseBody(polishReplySchema, req.body, res);
  if (!data) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  try {
    const { text } = await generateText({
      model: geminiModel,
      maxRetries: aiMaxRetries,
      prompt:
        "You are helping a support agent polish a reply to a customer ticket. " +
        "Rewrite the draft below to be clear, professional, and courteous while preserving its " +
        "meaning and any specific facts (names, dates, amounts, links). Keep it about the same " +
        "length. Do not add a greeting or sign-off — those are added separately. Respond with " +
        "only the rewritten reply body text, no preamble or quotes.\n\n" +
        `Ticket subject: ${ticket.subject}\n\nDraft reply:\n${data.body}`,
    });
    const polished = `Hi ${ticket.senderName},\n\n${text.trim()}\n\nRegards,\n${session.user.name}`;
    res.json({ text: polished });
  } catch (err) {
    console.error("polish-reply failed:", err);
    res.status(502).json({ error: "Failed to polish reply" });
  }
});

ticketsRouter.post("/:id/replies", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const params = parseBody(ticketIdParamSchema, req.params, res);
  if (!params) return;

  const data = parseBody(createReplySchema, req.body, res);
  if (!data) return;

  const ticket = await prisma.ticket.findUnique({ where: { id: params.id } });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const reply = await prisma.ticketReply.create({
    data: { body: data.body, ticketId: params.id, authorId: session.user.id },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
  res.status(201).json(reply);
});
