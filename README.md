# alaseel-pod

Proof of Deliver platform for Al Aseel.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, Clerk, Drizzle ORM, Neon Postgres, OpenNext on Cloudflare Workers (Wrangler). Use Hyperdrive in production for pooled DB access from the edge.

## Setup

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`.
2. `npm install`
3. Apply migrations: `npm run db:migrate`
4. `npm run dev`

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Next.js production build |
| `npm run db:generate` | Generate SQL from `src/db/schema.ts` into `db/migrations/` |
| `npm run db:migrate` | Run migrations against `DATABASE_URL` |
| `npm run preview` | OpenNext build + local Workers preview |
| `npm run deploy` | OpenNext build + deploy to Cloudflare |

## Env files

- **`.env.example`** — committed template (no secrets).
- **`.env`**, **`.env.local`**, **`.env.production`** — gitignored; created locally with placeholders.

For Cloudflare local preview, `.dev.vars` can set `NEXTJS_ENV` (see Wrangler docs).
