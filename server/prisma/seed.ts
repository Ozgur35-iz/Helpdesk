import { auth } from "../src/auth";
import { prisma } from "../src/db";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment");
  }

  const ctx = await auth.$context;

  const existing = await ctx.internalAdapter.findUserByEmail(email);
  if (existing) {
    console.log(`Admin user ${email} already exists, skipping.`);
    return;
  }

  const user = await ctx.internalAdapter.createUser({
    email,
    name: "Admin",
    emailVerified: true,
    role: "admin",
  });

  const hashedPassword = await ctx.password.hash(password);
  await ctx.internalAdapter.linkAccount({
    accountId: user.id,
    providerId: "credential",
    password: hashedPassword,
    userId: user.id,
  });

  console.log(`Created admin user: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
