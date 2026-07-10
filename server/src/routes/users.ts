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

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email"),
  password: z.union([z.literal(""), z.string().min(5, "Password must be at least 5 characters")]).optional(),
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
    where: { deletedAt: null },
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

usersRouter.patch("/:id", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (session.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { name, email, password } = parsed.data;

  const ctx = await auth.$context;

  const target = await ctx.internalAdapter.findUserById(req.params.id);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const existing = await ctx.internalAdapter.findUserByEmail(email);
  if (existing && existing.user.id !== target.id) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  try {
    const updated = await ctx.internalAdapter.updateUser(target.id, { name, email });

    if (password) {
      const hashedPassword = await ctx.password.hash(password);
      await ctx.internalAdapter.updatePassword(target.id, hashedPassword);
    }

    res.json({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    throw err;
  }
});

usersRouter.delete("/:id", async (req, res) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (session.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.role === "admin") {
    res.status(403).json({ error: "Admins cannot be deleted" });
    return;
  }

  await prisma.user.update({ where: { id: target.id }, data: { deletedAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId: target.id } });

  res.status(200).json({ id: target.id });
});
