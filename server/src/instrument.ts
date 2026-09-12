import * as Sentry from "@sentry/node";

// Preloaded via `--import` (bun/node flag) before any other module loads, per
// Sentry's recommended ESM setup. See server/CLAUDE.md ("Error logging").
//
// Error logging only: tracesSampleRate is pinned to 0 and no tracing/profiling
// integrations are added. If SENTRY_DSN is unset (e.g. local dev before a real
// DSN exists, or server/.env.test), Sentry.init creates a disabled no-op
// client — captureException calls elsewhere become harmless no-ops.
//
// disableInstrumentationWarnings: Bun doesn't implement Node's `module.register`
// loader-hook API that `import-in-the-middle` needs for auto-instrumentation, so
// express/http never get patched here even with `--import` wired correctly
// (verified: the warning persists on a direct `bun --import ./src/instrument.ts`
// run, so it isn't an import-order bug in this codebase). That only means
// automatic spans/breadcrumbs for those libraries are unavailable — irrelevant
// since tracesSampleRate is 0 — so the warning is a false positive here.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate: 0,
  disableInstrumentationWarnings: true,
});
