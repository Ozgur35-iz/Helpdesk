import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { auth } from "../auth";
import { prisma } from "../db";
import { parseBody } from "../lib/validate";

const sortableFields = ["subject", "status", "category", "createdAt"] as const;

const ticketsQuerySchema = z.object({
  sortBy: z.enum(sortableFields).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
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

  const tickets = await prisma.ticket.findMany({
    orderBy: { [query.sortBy]: query.sortOrder },
  });
  res.json(tickets);
});
