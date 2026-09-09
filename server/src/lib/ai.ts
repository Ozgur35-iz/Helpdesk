import { google } from "@ai-sdk/google";

// Single source of truth for the Gemini model used by every AI feature
// (classification, KB auto-resolve, summarize, polish-reply).
//
// `gemini-flash-lite-latest` — a Google-maintained rolling alias, so it doesn't
// break as specific versions are deprecated. We use the *lite* alias rather than
// `gemini-flash-latest` because the plain Flash alias is frequently 503
// ("experiencing high demand") on the free tier, and each failed attempt hangs
// ~60s before the SDK gives up. Lite has far more free-tier capacity.
export const geminiModel = google("gemini-flash-lite-latest");

// Keep the AI SDK's own retrying short — the callers (a pg-boss job or an HTTP
// request an agent is waiting on) should fail fast rather than stack three ~60s
// upstream attempts. Background jobs own their own retry/backoff via pg-boss.
export const aiMaxRetries = 1;
