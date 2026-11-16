@AGENTS.md

# Local development

- Develop against the local Supabase stack, not mocks unless stated otherwise. Setup is in the README
  ("First-time setup"): `supabase start`, copy `supabase status -o env` into
  `.env.local`, renaming `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`, `ANON_KEY` →
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
  (the app reads only these three; the CLI's other variables are unused), `supabase db reset`, `npm run db:seed-storage`, `npm run dev`.
- Local ports are `544xx` (API `54421`, Studio `54423`), not the CLI's usual `543xx`.
- Seeded logins: `soft@` / `elec@` / `mech@sailbot.local`, password `test`, all leads.
  Admin is `profiles.role = 'admin'`; promote a lead via SQL to test it.
- Auth flow: `src/proxy.ts` (Next 16's renamed middleware) calls `updateSession`
  (`src/lib/supabase/middleware.ts`) to refresh the session and only checks
  signed-in vs not. Role and team come from `profiles`, read in
  `src/app/(admin)/admin/layout.tsx`; RLS is the real authorisation boundary.
- `scripts/seed-storage.mjs` parses `.env.local` with Node's `util.parseEnv`, so
  quoted values work. Any new script that reads env files should do the same.
- A stale `.next` cache can keep reporting a missing module after `npm install`;
  `rm -rf .next` fixes it.
