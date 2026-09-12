import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth";
import { prisma } from "../db";

export const metricsRouter = Router();

const TICKETS_PER_DAY_WINDOW = 30;

// Build a dense [{ date, count, resolved }] array covering the last N UTC days
// (oldest first), filling days with no activity with 0 so the chart always has N
// bars. `count` is tickets created that day (drives bar height); `resolved` is
// tickets whose resolvedAt falls on that day (shown in the hover tooltip).
function densifyPerDay(
  createdRows: { day: string; count: number }[],
  resolvedRows: { day: string; count: number }[],
  days: number,
): { date: string; count: number; resolved: number }[] {
  const created = new Map(createdRows.map((r) => [r.day, Number(r.count)]));
  const resolved = new Map(resolvedRows.map((r) => [r.day, Number(r.count)]));
  const today = new Date();
  const out: { date: string; count: number; resolved: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const date = d.toISOString().slice(0, 10);
    out.push({ date, count: created.get(date) ?? 0, resolved: resolved.get(date) ?? 0 });
  }
  return out;
}

// Aggregate numbers for the dashboard (client/src/pages/DashboardPage.tsx).
// Session-gated but open to any role — it's team-wide operational data, not
// admin-only like the user-management routes.
metricsRouter.get("/", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [totalTickets, openTickets, aiResolvedTickets, avgRows, perDayRows, resolvedPerDayRows] =
    await Promise.all([
      prisma.ticket.count(),
      prisma.ticket.count({ where: { status: "open" } }),
      // An AI-resolved ticket is the only kind that carries a stored reply draft.
      prisma.ticket.count({ where: { aiResolutionReply: { not: null } } }),
      prisma.$queryRaw<{ avg: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt"))) AS avg
        FROM "ticket"
        WHERE "resolvedAt" IS NOT NULL
      `,
      prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS count
        FROM "ticket"
        WHERE "createdAt" >= (now() AT TIME ZONE 'UTC')::date - make_interval(days => ${TICKETS_PER_DAY_WINDOW - 1})
        GROUP BY day
        ORDER BY day
      `,
      prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(("resolvedAt" AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day,
               COUNT(*)::int AS count
        FROM "ticket"
        WHERE "resolvedAt" IS NOT NULL
          AND "resolvedAt" >= (now() AT TIME ZONE 'UTC')::date - make_interval(days => ${TICKETS_PER_DAY_WINDOW - 1})
        GROUP BY day
        ORDER BY day
      `,
    ]);

  const rawAvg = avgRows[0]?.avg;
  const avgResolutionSeconds = rawAvg == null ? null : Number(rawAvg);
  const aiResolvedPercent = totalTickets === 0 ? 0 : (aiResolvedTickets / totalTickets) * 100;

  res.json({
    totalTickets,
    openTickets,
    aiResolvedTickets,
    aiResolvedPercent,
    avgResolutionSeconds,
    ticketsPerDay: densifyPerDay(perDayRows, resolvedPerDayRows, TICKETS_PER_DAY_WINDOW),
  });
});
