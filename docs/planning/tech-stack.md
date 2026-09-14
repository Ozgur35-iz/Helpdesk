# Tech Stack

## Application

- **Next.js (App Router, TypeScript)** — single full-stack app: React for the dashboard/ticket list/detail views, API routes/server actions for backend logic.
- **PostgreSQL** + **Prisma** — ticket, category, status, and user/role models.

## Authentication

- **Auth.js (NextAuth)** using the **database session strategy** (not JWT) — sessions stored in Postgres via the Prisma adapter, so sessions can be revoked/invalidated server-side (e.g. when an admin removes an agent).
- Two roles: **admin** (created on deploy, can create additional agents) and **agent**.

## Email ingestion/sending

- **Postmark** or **Mailgun** (inbound routing + outbound sending) — inbound email parsed into a webhook payload (from, subject, body, attachments, thread headers); no self-hosted mail server needed.
- `In-Reply-To` / `References` headers used to keep email threads tied to the correct ticket.

## AI

- **Anthropic API (Claude)** for ticket classification, summaries, and suggested replies — uses tool use / structured output to force classification into the fixed category enum (general question, technical question, refund request).
- **pgvector** (Postgres extension) for knowledge-base embeddings/retrieval — keeps KB data in the same database rather than standing up a separate vector DB; revisit only if the KB grows large enough that pgvector performance becomes a bottleneck.

## Background work

- Job queue table + worker process (or **BullMQ + Redis** if a proven library is preferred) — inbound emails and AI calls processed async so requests aren't blocked; ticket state updated when processing completes.

## Frontend

- **Tailwind CSS** — utility styling.
- **shadcn/ui** (Radix + Tailwind) — tables, dialogs, dropdowns, badges (status/category chips), form primitives; components are copied in rather than locked behind a dependency.
- **TanStack Table** — filtering/sorting/pagination for the ticket list (client-side at low volume, server-side as ticket count grows).
- **TanStack Query** — client-side fetching/caching/refetching, useful once AI classification/summary results arrive asynchronously.
- **React Hook Form + Zod** — admin user-management forms and agent reply-editing forms.
- **Tremor** or **Recharts** — dashboard metrics (tickets by status/category, volume over time), if needed.
- **lucide-react** — icons.

## Hosting

- **Vercel** for the Next.js app.
- **Railway / Render / Neon** for Postgres.

## Open tradeoffs

- Monolith-first stack optimized for a small team shipping fast; revisit if there's an existing helpdesk to integrate with or existing cloud/infra commitments.
- shadcn/ui + TanStack requires more setup than a batteries-included kit (Mantine, Ant Design), but yields components that can be customized for AI-specific UI (inline suggested-reply editing, confidence-score badges) that closed kits don't provide out of the box.
