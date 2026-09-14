import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  trustedOrigins: [process.env.CLIENT_ORIGIN ?? "http://localhost:5173"],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    customRules: {
      "/sign-in/email": {
        window: 30,
        max: 4,
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: ["admin", "agent"],
        required: false,
        defaultValue: "agent",
        input: false,
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // These endpoints have no UI in this app (client only ever calls
      // useSession/signIn.email/signOut) and better-auth mounts them
      // regardless of config, so block them outright rather than leave an
      // unused account-takeover surface (e.g. change-password against the
      // published demo login).
      if (
        ctx.path === "/change-password" ||
        ctx.path === "/update-user" ||
        ctx.path === "/change-email" ||
        ctx.path === "/delete-user" ||
        ctx.path === "/set-password"
      ) {
        throw new APIError("FORBIDDEN", { message: "Not available" });
      }

      if (ctx.path !== "/sign-in/email") return;
      const email = ctx.body?.email;
      if (!email) return;

      const user = await prisma.user.findUnique({ where: { email } });
      if (user?.deletedAt) {
        // Same message/status better-auth itself uses for a wrong password, so a
        // deactivated account can't be distinguished from a wrong password or a
        // nonexistent email (avoids account-existence enumeration).
        throw new APIError("UNAUTHORIZED", {
          message: "Invalid email or password",
        });
      }
    }),
  },
});
