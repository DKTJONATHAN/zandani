# Newsletter → Supabase migration

## 1. Run the SQL

In Supabase Dashboard → SQL Editor, run:

`supabase/migrations/20260922120000_newsletter_subscribers.sql`

(Or `supabase db push` if you use the CLI against the project in `.env` / `VITE_SUPABASE_URL`.)

## 2. Cloudflare Pages env vars

Add (Secrets):

- `SUPABASE_URL` = same as `VITE_SUPABASE_URL` (e.g. https://nkcnslswfbxrcvvlqxpy.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY` = Project Settings → API → `service_role` (secret, never expose to frontend)

Keep existing `RESEND_API_KEY` / `RESEND_FROM` for welcome emails.

You can stop relying on `PERSONAL_GITHUB_TOKEN` for newsletter subscribe once this is live (worker may still use it for other features).

## 3. Import existing `data/subscribers.json`

After the table exists, bulk-insert from the JSON (see Grok or generate INSERT from the file). Use `ON CONFLICT (email) DO UPDATE` so re-runs are safe.

## 4. Deploy

Merge branch `feat/newsletter-supabase` and redeploy Cloudflare Pages so `/api/subscribe` and `/api/unsubscribe` use Supabase.
