# Atelier Store

Next.js (App Router) + TypeScript + Tailwind CSS, with Better Auth and Drizzle ORM on PostgreSQL.

## Setup

1. Install dependencies: `npm install`
2. Copy env and fill in values: `cp .env.example .env`
   - `BETTER_AUTH_SECRET`: `openssl rand -base64 32`
   - `DATABASE_URL`: a PostgreSQL database on `localhost:5432`
3. Generate the Better Auth tables: `npm run auth:generate`, then uncomment the export in `src/db/schema.ts`
4. Apply the schema: `npm run db:push` (or `db:generate` + `db:migrate`)
5. Run: `npm run dev`

## Structure

- `src/db/index.ts` — Drizzle client (node-postgres pool)
- `src/db/schema.ts` — Drizzle schema entry point
- `drizzle.config.ts` — drizzle-kit config (migrations in `./drizzle`)
- `src/lib/auth.ts` — Better Auth server instance
- `src/lib/auth-client.ts` — Better Auth React client
- `src/app/api/auth/[...all]/route.ts` — Better Auth route handler

## Scripts

| Script | Purpose |
| --- | --- |
| `dev` / `build` / `start` | Next.js |
| `lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `auth:generate` | Generate Better Auth Drizzle schema |
| `db:generate` / `db:migrate` / `db:push` / `db:studio` | drizzle-kit |
