# Helpdesk

An AI-assisted support-ticket system that takes the manual triage out of a support inbox: tickets come in over a webhook, get auto-classified and — where possible — auto-resolved against a knowledge base in the background, and human agents get AI-drafted summaries and reply polishing for everything that still needs a person.

## Why

Support agents were triaging incoming emails by hand — reading each one, guessing at category/priority, and writing replies from scratch even when the answer already existed in a knowledge base. This project automates the repetitive part of that loop (classification, first-pass resolution) while keeping a human in charge of anything the AI isn't confident about, with an admin/agent role split and a metrics dashboard to track how well the automation is doing.

## Live demo

https://ticket-management-project-production.up.railway.app

Demo login: `demouser@example.com` / `demouserpass`

## Features

- **Auth & role-based access** — email/password auth (`better-auth`), admin vs. agent roles, protected routes on both client and server
- **User management** — admins can create, edit, and remove agent accounts
- **Ticket workflow** — list/detail views with sorting, filtering, search, and pagination; assign, update, and reply to tickets
- **Inbound email intake** — tickets are created via a secret-authenticated webhook (`POST /inbound-email`), no IMAP/polling required
- **AI auto-classification** — every new ticket is categorized automatically by a background job (Gemini via `@ai-sdk/google`)
- **AI auto-resolution** — incoming tickets are graded against a knowledge base (`server/knowledge-base.md`); a good match resolves the ticket automatically, otherwise it's handed to an agent (`new → processing → resolved | open`)
- **AI ticket summarization** — on-demand summary of a ticket's thread for agents
- **AI reply polishing** — agents draft a reply, AI cleans it up before sending
- **Metrics dashboard** — total/open tickets, AI-resolved count and share, average resolution time
- **Error monitoring** — Sentry wired into both client and server (no-op if unconfigured)

> Outbound email sending is not implemented — replies are stored on the ticket, not emailed out.

## Tech stack

| Layer | Tech |
|---|---|
| Monorepo | Bun workspaces (`client/`, `server/`) |
| Client | Vite, React 19, React Router, plain CSS |
| Server | Express, Prisma, `better-auth` |
| Database | PostgreSQL |
| Background jobs | pg-boss (classification + auto-resolve queues, separate worker process) |
| AI | `@ai-sdk/google` (Gemini) |
| Testing | Playwright (e2e), Vitest + React Testing Library (component) |
| Monitoring | Sentry (`@sentry/react`, `@sentry/node`) |
| Deploy | Docker / Railway (Nixpacks) |

## Architecture

- The **client** is a Vite/React SPA; in dev it proxies `/api` to the server so `better-auth`'s client and server talk same-origin.
- The **server** is Express, mounting `better-auth` at `/api/auth/*` and REST routes for tickets, users, metrics, and the inbound-email webhook.
- A separate **worker** process (no hot-reload) runs the pg-boss queues that do ticket classification and knowledge-base auto-resolution against the same Postgres database — this keeps AI calls off the request path.

## Getting started

**Prerequisites:** [Bun](https://bun.sh), a running PostgreSQL instance.

```bash
# install workspace dependencies
bun install

# configure environment
cp server/.env.example server/.env
cp client/.env.example client/.env
# fill in server/.env: DATABASE_URL, BETTER_AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD,
# GOOGLE_GENERATIVE_AI_API_KEY, INBOUND_EMAIL_SECRET
# (SENTRY_DSN / VITE_SENTRY_DSN are optional — error reporting no-ops without them)

# set up the database and seed an admin user
cd server
bun run db:migrate
bun run db:seed
cd ..

# run everything (client + server + worker)
bun run dev
```

- Client: http://localhost:5173
- Server: http://localhost:3001

Individual pieces can also be run on their own: `bun run dev:client`, `bun run dev:server`, `bun run dev:worker`.

## Running with Docker

```bash
# after populating server/.env
docker compose up --build
```

Postgres itself isn't containerized — the `server` and `worker` services expect a Postgres instance reachable from the host (via `host.docker.internal`). Once up, the server is available at http://localhost:3010.

## Testing

```bash
# end-to-end (Playwright, against an isolated test DB/ports)
bun run test:e2e
bun run test:e2e:ui

# component tests (Vitest + React Testing Library)
cd client
bun run test:component
```

## Project structure

```
client/    Vite/React app
server/    Express API, Prisma schema, AI classification/auto-resolve jobs, worker entrypoint
e2e/       Playwright specs (login, users, inbound-email webhook, metrics)
```

## Deployment

Both a `Dockerfile`/`docker-compose.yml` and Railway service configs (`railway.json` for the web service, `railway.worker.json` for the worker) are included, so the app can be deployed either as a container or via Railway's Nixpacks build.

## Built with Claude Code

This project was also a deliberate exercise in agentic, AI-assisted development — built end-to-end with Claude Code to learn how to direct an AI coding agent effectively: scoping tasks, reviewing its output, and making the architecture calls myself.
