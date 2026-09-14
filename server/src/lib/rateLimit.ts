import rateLimit from "express-rate-limit";

// Guards the on-demand AI routes (summarize, polish-reply) — unlike
// classification/auto-resolve these run synchronously on a request an agent
// is waiting on, with no queue to naturally throttle them, so a logged-in
// user hammering the endpoint directly burns Gemini quota/cost.
export const aiRouteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many AI requests, please slow down and try again shortly." },
});

// Guards the inbound-email webhook — unauthenticated by design (secret-header
// checked in the route itself), so if the secret ever leaks this bounds how
// fast an attacker can create tickets and fan out Gemini jobs.
export const webhookRouteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down and try again shortly." },
});

// Guards ticket-mutating routes (replies, assign, status, category) — any
// logged-in session (including the public demo login) can write to every
// ticket by design, so without a limit that account is a spam/write-anything
// credential over the live data.
export const mutationRouteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down and try again shortly." },
});
