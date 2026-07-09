---
name: component-testing
description: Write or run Vitest + React Testing Library component tests for the client package. Use when adding/updating a *.test.tsx file under client/src, or asked to run component tests.
---

# Component tests

Component tests use **Vitest + React Testing Library**, run against `jsdom`, and live next to the component they cover as `*.test.tsx` (e.g. `client/src/pages/UsersPage.test.tsx`). Run them with `bun run test:component` (single run) or `bun run test:component:watch` (watch mode) from `client/`.

- Config lives in `client/vite.config.ts` under the `test` key (`environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`). `globals: true` means `describe`/`it`/`expect`/`vi`/etc. are available without importing them; `tsconfig.app.json` includes `vitest/globals` and `@testing-library/jest-dom` types for that to typecheck.
- `client/src/test/setup.ts` wires up `@testing-library/jest-dom/vitest` matchers (`toBeInTheDocument()`, etc.) for every test file.
- Any component under test that uses TanStack Query needs a `QueryClientProvider` ancestor. Use the shared `renderWithQuery` helper from `client/src/test/renderWithQuery.tsx` instead of hand-rolling a `QueryClient`/`QueryClientProvider` wrapper per test file — it creates a fresh `QueryClient` per render with `retry: false` (so failed-request tests don't hang retrying) and renders via RTL's `render`.
- Mock `axios` at the module level with `vi.mock("axios", () => ({ default: { get: vi.fn(), isAxiosError: vi.fn() } }))`, then get typed handles via `vi.mocked(axios.get)` / `vi.mocked(axios.isAxiosError)`. Reset both mocks in `beforeEach`. See `UsersPage.test.tsx` for the full pattern, including asserting both the axios-error branch (`response.data.error`) and the generic `error.message` fallback.
- For components with real timers in their logic (e.g. `UsersPage`'s `MIN_SKELETON_MS` skeleton delay), use `vi.useFakeTimers()` scoped to the individual test that needs it (not globally in `beforeEach`) — RTL's `findBy*`/`waitFor` poll using real timers under the hood, so leaving fake timers on for every test makes those queries hang. Advance time inside `await act(async () => { await vi.advanceTimersByTimeAsync(ms) })`, and always pair with `vi.useRealTimers()` in `afterEach`.
