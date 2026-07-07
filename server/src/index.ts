import express from "express";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth";
import { prisma } from "./db";

const app = express();
const port = process.env.PORT ?? 3001;

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "ok", db: "unreachable" });
  }
});

app.get("/api/users", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (session.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
