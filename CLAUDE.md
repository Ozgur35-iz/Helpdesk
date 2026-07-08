# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A support-ticket management system (see `project-scope.md` for the full problem/feature spec): agents currently triage support emails by hand; the goal is a system that auto-classifies, summarizes, and suggests replies for tickets using AI, with an admin/agent role split. Only early setup (auth, login) is implemented so far — see "Stack reality vs. planning docs" below.

## Commands

This is a Bun workspace monorepo with two packages: `client` (Vite/React) and `server` (Express/Bun).

```bash
bun run dev             # runs both client and server dev servers concurrently (bun --filter '*' dev)
bun run dev:client       # client only -> http://localhost:5173
bun run dev:server       # server only -> http://localhost:3001 (bun --watch)
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

E2E testing runs on Playwright against an isolated test database (`helpdesk_test`, server on port 3002, client on port 5174 — see `playwright.config.ts` and `server/.env.test`), configured via `test:e2e*` scripts above. No test files exist yet. Conventions for writing them (selectors, auth/session handling, what's actually implemented vs. planned) live in `.claude/agents/e2e-tester.md`, not here — use that subagent rather than duplicating its guidance in this file.

**Whenever the login page (`client/src/pages/LoginPage.tsx`) needs test coverage — writing new tests, extending existing ones, or verifying a change to the login/auth flow still works — delegate to the `e2e-tester` subagent instead of writing or editing Playwright specs directly.** It already knows the seeded test-DB admin credentials (`ADMIN_EMAIL`/`ADMIN_PASSWORD` in `server/.env.test`), the login form's actual markup/selectors, and how `GuestOnly`/`RequireAuth` redirect behavior around `/login` is supposed to work, so it won't need to rediscover that context. This applies even to small asks like "add a test for wrong password" or "check login still works after this change" — route those to `e2e-tester` rather than handling them inline.

### Component tests

Component tests use **Vitest + React Testing Library**, run against `jsdom`, and live next to the component they cover as `*.test.tsx` (e.g. `client/src/pages/UsersPage.test.tsx`). Run them with `bun run test:component` (single run) or `bun run test:component:watch` (watch mode) from `client/`.

- Config lives in `client/vite.config.ts` under the `test` key (`environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`). `globals: true` means `describe`/`it`/`expect`/`vi`/etc. are available without importing them; `tsconfig.app.json` includes `vitest/globals` and `@testing-library/jest-dom` types for that to typecheck.
- `client/src/test/setup.ts` wires up `@testing-library/jest-dom/vitest` matchers (`toBeInTheDocument()`, etc.) for every test file.
- Any component under test that uses TanStack Query needs a `QueryClientProvider` ancestor. Use the shared `renderWithQuery` helper from `client/src/test/renderWithQuery.tsx` instead of hand-rolling a `QueryClient`/`QueryClientProvider` wrapper per test file — it creates a fresh `QueryClient` per render with `retry: false` (so failed-request tests don't hang retrying) and renders via RTL's `render`.
- Mock `axios` at the module level with `vi.mock("axios", () => ({ default: { get: vi.fn(), isAxiosError: vi.fn() } }))`, then get typed handles via `vi.mocked(axios.get)` / `vi.mocked(axios.isAxiosError)`. Reset both mocks in `beforeEach`. See `UsersPage.test.tsx` for the full pattern, including asserting both the axios-error branch (`response.data.error`) and the generic `error.message` fallback.
- For components with real timers in their logic (e.g. `UsersPage`'s `MIN_SKELETON_MS` skeleton delay), use `vi.useFakeTimers()` scoped to the individual test that needs it (not globally in `beforeEach`) — RTL's `findBy*`/`waitFor` poll using real timers under the hood, so leaving fake timers on for every test makes those queries hang. Advance time inside `await act(async () => { await vi.advanceTimersByTimeAsync(ms) })`, and always pair with `vi.useRealTimers()` in `afterEach`.

## Architecture

**Auth is the backbone of both apps.** `better-auth` runs on the server (`server/src/auth.ts`) with the Prisma adapter, and is mounted wholesale at `app.all("/api/auth/*splat", toNodeHandler(auth))` in `server/src/index.ts` — before `express.json()`, so better-auth handles its own body parsing. The client talks to it via `better-auth/react`'s `createAuthClient()` (`client/src/lib/auth-client.ts`), with no explicit base URL — it relies on Vite's dev proxy (`client/vite.config.ts`: `/api` → `http://localhost:3001`) to reach the server same-origin. In production, the client and server must be served such that `/api` still reaches the auth server, or `createAuthClient({ baseURL })` needs to be set explicitly.

**Route protection is session-based, not token-based**, driven by `authClient.useSession()`. `client/src/routes/guards.tsx` exports `RequireAuth` (redirects to `/login` if no session) and `GuestOnly` (redirects to `/` if already logged in), both used as wrapping `<Route element={...}>` layouts in `client/src/App.tsx` rather than per-page checks. The authenticated area is further wrapped in `Layout` (adds the `Navbar`); the login page is deliberately outside `Layout` so it renders standalone (see `.login-page` centering in `App.css`).

**Roles** (`admin` | `agent`) live on `User.role` in `server/prisma/schema.prisma`, exposed to better-auth via `user.additionalFields.role` in `auth.ts` with `input: false` — meaning role can never be set through the public sign-up/update API, only via direct DB/adapter access. Sign-up is disabled entirely (`emailAndPassword.disableSignUp: true`); the only way to create a user is `server/prisma/seed.ts`, which creates a single admin using `auth.$context` (`internalAdapter.createUser` + `ctx.password.hash` + `linkAccount`) rather than an HTTP call. There is currently no "admin creates an agent" endpoint — that's planned but not built (see `implementation-plan.md` Phase 3).

**Generated Prisma client is committed to git.** `schema.prisma` outputs to `server/generated/prisma` (not `node_modules`), and that generated directory is tracked in version control rather than gitignored — after any schema change, run `db:generate` (and `db:migrate` for a schema change) and commit the regenerated output along with the migration.

**Env vars** are consumed via `process.env` directly in server code (Bun auto-loads `.env`); the Prisma CLI config (`server/prisma.config.ts`) additionally does an explicit `import "dotenv/config"` since it runs outside Bun's runtime. Known vars: `DATABASE_URL`, `PORT` (server, default 3001), `CLIENT_ORIGIN` (better-auth trusted origin, default `http://localhost:5173`), `ADMIN_EMAIL`/`ADMIN_PASSWORD` (seed script only).

**Forms** use React Hook Form + Zod resolvers, with Ark UI (`@ark-ui/react`, `Field.Root/Label/Input/ErrorText`) as the headless component layer over native inputs — see `client/src/pages/LoginPage.tsx` for the pattern (manual shake-on-error animation via refs + `Field` for markup/accessibility, not for animation).

**Data fetching** on the client uses `axios` (not the raw `fetch` API) for HTTP calls, wrapped in TanStack Query (`@tanstack/react-query`) for server state — `useQuery`/`useMutation` rather than manual `useState`/`useEffect` loading/error juggling. `QueryClientProvider` is set up once in `client/src/main.tsx`. See `client/src/pages/UsersPage.tsx` for the pattern.

## Stack reality vs. planning docs

`project-scope.md`, `tech-stack.md`, and `implementation-plan.md` in this repo root were written during early planning and describe an *intended* stack: Next.js (App Router), Auth.js/NextAuth, shadcn/ui + Tailwind + TanStack Table/Query, Postmark/Mailgun, Claude API + pgvector.

The actual implementation diverged:
- Bun workspace monorepo (`/client`, `/server`), not a single Next.js app.
- Client: Vite + React 19 + React Router, not Next.js. Plain CSS, no Tailwind/shadcn yet.
- Server: Express + Prisma + `better-auth`, not Auth.js.
- Only Phase 1–2 of `implementation-plan.md` are actually done (login page + better-auth wired, admin seed script). Ticket CRUD, AI features, and email integration (Phases 4–6) haven't been started.

Don't assume the planning docs reflect current reality — check `package.json` and the actual code before recommending an approach "per the plan."
