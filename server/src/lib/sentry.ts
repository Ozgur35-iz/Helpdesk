import * as Sentry from "@sentry/node";

// Re-exports the Sentry namespace for captureException calls throughout the
// server and worker. Sentry.init() itself runs in src/instrument.ts, preloaded
// via `--import` before this (or any other) module loads.
export { Sentry };
