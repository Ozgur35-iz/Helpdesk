# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A support-ticket management system (see `project-scope.md` for the full problem/feature spec): agents currently triage support emails by hand; the goal is a system that auto-classifies, summarizes, and suggests replies for tickets using AI, with an admin/agent role split. Auth, user management, and ticket CRUD/workflow are implemented; AI features and outbound email are not — see "Stack reality vs. planning docs" below.

## Fix log

Whenever you fix a bug or error (a button not working, a broken test, a crash, etc.) — as opposed to adding a new feature or doing a refactor — append an entry to `fix-log.md` at the repo root right after the fix is verified working. Newest entry on top (add it directly under the `# Fix Log` heading, above other entries). Use this format:

```
## YYYY-MM-DD — Short problem title

**Problem:** What was broken and how it showed up (error message, symptom, repro steps).

**Solution:** What was changed to fix it and why. Include file paths.

**Files:** path/one.ts, path/two.tsx
```

Keep entries short and concrete — this file is read by the user afterward to commit the fix to their own memory, not as documentation for the codebase. Don't log feature work, refactors, or exploratory changes here, only actual bug/error fixes.

## Commands

This is a Bun workspace monorepo with two packages: `client` (Vite/React) and `server` (Express/Bun).

```bash
bun run dev             # client + server + classification worker, together (concurrently -k)
bun run dev:client       # client only -> http://localhost:5173
bun run dev:server       # HTTP server only -> http://localhost:3001 (bun --watch)
bun run dev:worker       # pg-boss worker only — classification + auto-resolve queues (plain bun, NO --watch)
bun run test:e2e         # migrates/seeds the test DB, then runs Playwright against it
bun run test:e2e:setup   # just the test DB migrate+seed step (idempotent)
bun run test:e2e:ui      # test:e2e, but with the Playwright UI runner
```

Client (`cd client`):
```bash
bun run build                  # tsc -b && vite build
bun run lint                    # oxlint
bun x tsc -b --noEmit           # typecheck only, no emit
bun run test:component          # vitest run - runs component tests once
bun run test:component:watch    # vitest - watch mode
```

Server (`cd server`):
```bash
bun run typecheck         # tsc --noEmit
bun run db:generate       # prisma generate -> writes into server/generated/prisma
bun run db:migrate        # prisma migrate dev
bun run db:studio         # prisma studio
bun run db:seed           # bun prisma/seed.ts - creates the admin user from ADMIN_EMAIL/ADMIN_PASSWORD env vars
```

E2E testing runs on Playwright against an isolated test database (`helpdesk_test`, server on port 3002, client on port 5174 — see `playwright.config.ts` and `server/.env.test`), configured via `test:e2e*` scripts above. Spec files live under `e2e/` (login, users, inbound-email webhook so far). Conventions for writing them (selectors, auth/session handling, what's actually implemented vs. planned) live in `.claude/agents/e2e-tester.md`, not here — use that subagent rather than duplicating its guidance in this file.

**Whenever the login page (`client/src/pages/LoginPage.tsx`) needs test coverage — writing new tests, extending existing ones, or verifying a change to the login/auth flow still works — delegate to the `e2e-tester` subagent instead of writing or editing Playwright specs directly.** It already knows the seeded test-DB admin credentials (`ADMIN_EMAIL`/`ADMIN_PASSWORD` in `server/.env.test`), the login form's actual markup/selectors, and how `GuestOnly`/`RequireAuth` redirect behavior around `/login` is supposed to work, so it won't need to rediscover that context. This applies even to small asks like "add a test for wrong password" or "check login still works after this change" — route those to `e2e-tester` rather than handling them inline.

### Component tests

Component tests use Vitest + React Testing Library; see the `component-testing` skill for conventions (run via `bun run test:component` from `client/`).

## Architecture

Client- and server-specific conventions (route protection, forms, data fetching, roles, generated Prisma, env vars) live in `client/CLAUDE.md` and `server/CLAUDE.md`.

**Auth is the backbone of both apps.** `better-auth` runs on the server (`server/src/auth.ts`) with the Prisma adapter, and is mounted wholesale at `app.all("/api/auth/*splat", toNodeHandler(auth))` in `server/src/index.ts` — before `express.json()`, so better-auth handles its own body parsing. The client talks to it via `better-auth/react`'s `createAuthClient()` (`client/src/lib/auth-client.ts`), with no explicit base URL — it relies on Vite's dev proxy (`client/vite.config.ts`: `/api` → `http://localhost:3001`) to reach the server same-origin. In production, the client and server must be served such that `/api` still reaches the auth server, or `createAuthClient({ baseURL })` needs to be set explicitly.

## Stack reality vs. planning docs

`project-scope.md`, `tech-stack.md`, and `implementation-plan.md` in this repo root were written during early planning and describe an *intended* stack: Next.js (App Router), Auth.js/NextAuth, shadcn/ui + Tailwind + TanStack Table/Query, Postmark/Mailgun, Claude API + pgvector.

The actual implementation diverged:
- Bun workspace monorepo (`/client`, `/server`), not a single Next.js app.
- Client: Vite + React 19 + React Router, not Next.js. Plain CSS, no Tailwind/shadcn yet.
- Server: Express + Prisma + `better-auth`, not Auth.js.
- Done: login + better-auth, admin seed script, role-based access control, user management (create/edit/delete, `server/src/routes/users.ts`), and ticket workflow (`server/src/routes/tickets.ts`) — list/detail with sorting, filtering/search, pagination, assign, update, reply. Tickets can be created via an inbound-email webhook (`server/src/routes/webhooks.ts`, `POST /inbound-email`, secret-header auth) — there's no polling/IMAP integration, just a webhook endpoint. AI features use `@ai-sdk/google` (Gemini, not the planned Claude API/pgvector): automatic ticket categorization on creation and KB-driven auto-resolution on creation (both run as **pg-boss** background jobs — one queue module each under `server/src/queue/`, webhook enqueues, a separate no-watch worker process `server/src/worker.ts` runs `server/src/lib/classify.ts` and `server/src/lib/auto-resolve.ts`; see `server/CLAUDE.md`), on-demand ticket summarization (`POST /api/tickets/:id/summarize`), and reply polishing (`POST /api/tickets/:id/polish-reply`). Auto-resolution grades an incoming ticket against `server/knowledge-base.md`: tickets flow `new → processing → resolved | open`, and `new`/`processing` tickets are hidden from the ticket list. The `/` landing page is a metrics dashboard (`client/src/pages/DashboardPage.tsx` ← `GET /api/metrics`, `server/src/routes/metrics.ts`): total/open tickets, AI-resolved count and share, and average resolution time (from `Ticket.resolvedAt`). Playwright e2e (`e2e/`) covers login, users, the inbound webhook, and metrics; Vitest component tests exist for `TicketsPage`, `TicketDetailPage`, `UsersPage`, `DashboardPage`.
- Not started: outbound email sending (no Postmark/Mailgun/Resend integration — replies are stored, not emailed).

Don't assume the planning docs reflect current reality — check `package.json` and the actual code before recommending an approach "per the plan."
