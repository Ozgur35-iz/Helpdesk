# CLAUDE.md (server)

Server-specific conventions. See the repo-root `CLAUDE.md` for the cross-cutting auth architecture and overall project context.

**Roles** (`admin` | `agent`) live on `User.role` in `server/prisma/schema.prisma`, exposed to better-auth via `user.additionalFields.role` in `auth.ts` with `input: false` — meaning role can never be set through the public sign-up/update API, only via direct DB/adapter access. Sign-up is disabled entirely (`emailAndPassword.disableSignUp: true`); the only ways to create a user are `server/prisma/seed.ts` (single admin, via `auth.$context`) and the admin-only `POST /api/users` route (`server/src/routes/users.ts`), which creates agents the same way (`internalAdapter.createUser` + `ctx.password.hash` + `linkAccount`).

**Generated Prisma client is committed to git.** `schema.prisma` outputs to `server/generated/prisma` (not `node_modules`), and that generated directory is tracked in version control rather than gitignored — after any schema change, run `db:generate` (and `db:migrate` for a schema change) and commit the regenerated output along with the migration.

**Env vars** are consumed via `process.env` directly in server code (Bun auto-loads `.env`); the Prisma CLI config (`server/prisma.config.ts`) additionally does an explicit `import "dotenv/config"` since it runs outside Bun's runtime. Known vars: `DATABASE_URL`, `PORT` (server, default 3001), `CLIENT_ORIGIN` (better-auth trusted origin, default `http://localhost:5173`), `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed script only).
