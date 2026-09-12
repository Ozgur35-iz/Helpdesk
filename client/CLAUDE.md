# CLAUDE.md (client)

Client-specific conventions. See the repo-root `CLAUDE.md` for the cross-cutting auth architecture and overall project context.

**Route protection is session-based, not token-based**, driven by `authClient.useSession()`. `client/src/routes/guards.tsx` exports `RequireAuth` (redirects to `/login` if no session) and `GuestOnly` (redirects to `/` if already logged in), both used as wrapping `<Route element={...}>` layouts in `client/src/App.tsx` rather than per-page checks. The authenticated area is further wrapped in `Layout` (adds the `Navbar`); the login page is deliberately outside `Layout` so it renders standalone (see `.login-page` centering in `App.css`).

**Forms** use React Hook Form + Zod resolvers, with Ark UI (`@ark-ui/react`, `Field.Root/Label/Input/ErrorText`) as the headless component layer over native inputs — see `client/src/pages/LoginPage.tsx` for the pattern (manual shake-on-error animation via refs + `Field` for markup/accessibility, not for animation).

**Data fetching** on the client uses `axios` (not the raw `fetch` API) for HTTP calls, wrapped in TanStack Query (`@tanstack/react-query`) for server state — `useQuery`/`useMutation` rather than manual `useState`/`useEffect` loading/error juggling. `QueryClientProvider` is set up once in `client/src/main.tsx`. See `client/src/pages/UsersPage.tsx` for the pattern.

**Error logging** goes through `@sentry/react`, initialized once in `client/src/main.tsx` before `createRoot`, keyed off `VITE_SENTRY_DSN` (`client/.env`, git-ignored, empty locally — safe to leave blank since an empty DSN makes the SDK run as a disabled no-op client). Error-capture only — `tracesSampleRate: 0`, no tracing/replay integrations. React 19's native `onUncaughtError`/`onRecoverableError` hooks (passed to `createRoot`) are wired to `Sentry.reactErrorHandler()`, and `<Sentry.ErrorBoundary>` wraps the whole render tree (outside `QueryClientProvider`/`BrowserRouter`) with a plain fallback message; `onCaughtError` is deliberately left unwired to avoid double-reporting errors the boundary already caught.
