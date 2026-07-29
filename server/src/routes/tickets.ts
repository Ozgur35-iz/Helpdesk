import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { auth } from "../auth";
import { prisma } from "../db";
import { parseBody } from "../lib/validate";

const sortableFields = ["subject", "status", "category", "createdAt"] as const;
const statusValues = ["open", "pending", "resolved", "closed"] as const;
const categoryValues = ["billing", "technical", "account", "refund"] as const;

const ticketsQuerySchema = z.object({
  sortBy: z.enum(sortableFields).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(statusValues).optional(),
  category: z.enum([...categoryValues, "none"]).optional(),
  subject: z.string().trim().min(1).optional(),
  requester: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const ticketIdParamSchema = z.object({ id: z.coerce.number().int().positive() });
const assignTicketSchema = z.object({ assigneeId: z.string().min(1).nullable() });
const updateStatusSchema = z.object({ status: z.enum(statusValues) });
const updateCategorySchema = z.object({ category: z.enum(categoryValues).nullable() });
const createReplySchema = z.object({ body: z.string().trim().min(1, "Reply cannot be empty") });

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
  if (query.status) where.status = query.status;
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
