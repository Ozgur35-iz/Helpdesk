import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";
import { prisma } from "../db";

export const ticketsRouter = Router();

ticketsRouter.get("/", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json(tickets);
});
