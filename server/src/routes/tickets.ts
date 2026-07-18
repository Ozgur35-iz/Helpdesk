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
      orderBy: { [query.sortBy]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);
  res.json({ data: tickets, total, page: query.page, pageSize: query.pageSize });
});
