import express from "express";
import { prisma } from "./db";

const app = express();
const port = process.env.PORT ?? 3001;

app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch {
    res.status(503).json({ status: "ok", db: "unreachable" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
