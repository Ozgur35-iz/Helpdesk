import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { z } from "zod";
import { Prisma } from "../../generated/prisma/client";
import { auth } from "../auth";
import { prisma } from "../db";

const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.string().min(5, "Password must be at least 5 characters"),
});

export const usersRouter = Router();

usersRouter.get("/", async (req, res) => {
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

usersRouter.post("/", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (session.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { name, email, password } = parsed.data;

  const ctx = await auth.$context;

  const existing = await ctx.internalAdapter.findUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  try {
    const user = await ctx.internalAdapter.createUser({
      email,
      name,
      emailVerified: true,
      role: "agent",
    });

    const hashedPassword = await ctx.password.hash(password);
    await ctx.internalAdapter.linkAccount({
      accountId: user.id,
      providerId: "credential",
      password: hashedPassword,
      userId: user.id,
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    throw err;
  }
});
