# Shared catalog database

Local setup: copy `.env.example` to `.env.local`, then run `npm run dev`.
Fixture mode is accepted only with `NODE_ENV=development` or `test`. Production
build/start require `NEXT_PUBLIC_USE_FIXTURES=0` (or unset) and both public
Supabase values. Browser and server clients use the publishable key with RLS.
The Next.js config validates these values before starting or building.

The local seed is synthetic, not officially verified game data. Its fixed
interval is **2026-09-16 00:00 through 2026-09-19 00:00 Asia/Seoul**, excluding
the end. Fixture callers and E2E must pin their clock within this interval;
outside it, `getPublishedCatalog` throws `NoActivePriceCycleError`.
Source URLs, verified timestamps, UUIDs, recipes, prices and skill rules in
`seed.sql` match `src/features/catalog/server/fixture-rows.json`. `fixture-v1`
means fixture arithmetic only, not an approved game calculation ruleset.

With Docker running, execute from the project root:

```sh
npx supabase start
npx supabase db reset
npx supabase test db
```

`db reset` is destructive to the **local project database**. Do not add
`--linked` or use this synthetic seed in production. These commands are a
release gate: TypeScript tests do not establish that SQL/RLS works in PostgreSQL.

All eight tables enable RLS. Public catalog reads expose active data; public
price reads expose published cycles and their prices, including published
history. Current-cycle selection is `[starts_at, ends_at)` in the repository.
Authenticated writes require `app_metadata.role = 'admin'`; `user_metadata`
is never trusted. Audit history is admin-readable and append-only.

Admin publication workflows must validate complete dish coverage, recipe graph
cycles, skill level bounds and verified game rules, and write change history.
Auth routes/proxy must refresh sessions before admin Server Component reads.
Those workflow pieces are implemented by the admin task, not this schema task.

`PublishedCatalog` extends the existing calculation catalog structurally and
adds `activeCycle`, `prices`, `skills`, and a content-derived `dataVersion`.
Dates are ISO UTC strings; display them with `timeZone: 'Asia/Seoul'`.
The object stays JSON-compatible with the existing IndexedDB cache boundary.
