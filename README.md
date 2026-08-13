# Mega Clean CRM

Single-user web app for the owner of Mega Clean to manage the weekly cleaning roster and
month-end invoicing prep. Phase 1 MVP — see the top-level plan for full feature scope.

## Tech stack

- **Client**: Vite + React 19 + TypeScript, Tailwind CSS, wouter, react-hook-form + zod, date-fns.
- **Server**: Express + tRPC, Drizzle ORM over SQLite (`better-sqlite3`).
- **Auth**: single hardcoded admin password gating a signed session cookie (no per-user accounts).

## Getting started

```bash
npm install
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run db:migrate
npm run dev   # API on :4000, client on :5173
```

Log in with `ADMIN_PASSWORD` from `server/.env` (defaults to `changeme123` for local dev).

More documentation will land here as features are built out.
