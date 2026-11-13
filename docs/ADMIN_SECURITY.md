# Za Ndani admin security

The admin console uses a server-verified passphrase and a short-lived signed session. Do not put secrets in Vite environment variables, source files, or GitHub content.

## Required Cloudflare Worker secrets

Set these on the `zandani` Worker:

```bash
npx wrangler secret put ADMIN_PIN
npx wrangler secret put ADMIN_API_TOKEN
```

- `ADMIN_PIN`: use a unique passphrase with at least 12 characters.
- `ADMIN_API_TOKEN`: use a cryptographically random secret with at least 32 characters.

The Worker checks the passphrase after Cloudflare Turnstile verification, then issues a signed admin session that expires after 30 minutes. The browser stores only that short-lived session in `sessionStorage`.

## Required Supabase Edge Function secret

Set `ADMIN_API_TOKEN` in the Supabase project used by `supabase/config.toml` to the **same value** as the Cloudflare Worker secret:

```bash
supabase secrets set ADMIN_API_TOKEN="same-value-as-cloudflare"
```

The `index-now` Edge Function verifies the signed session before it can call IndexJump. It also accepts only canonical Za Ndani `/article/<slug>` URLs and at most five URLs per request.

## Public sports endpoints

- `football-data` is a public, read-only proxy. It now validates endpoint names, competition codes, match IDs and date ranges, and applies a best-effort per-IP request cap.
- `sports-ai-headlines` remains public because the Sports page uses it. It verifies each match ID with Football-Data.org, uses verified match facts, caches generated analysis, and applies a best-effort per-IP generation cap.
- `newsroom-writer` already requires the server-side Supabase secret key in its `apikey` header; never send that key to a browser.

## Deployment checklist

1. Configure the two Cloudflare Worker secrets above.
2. Configure the matching `ADMIN_API_TOKEN` Supabase secret.
3. Deploy the Worker and Supabase Edge Functions.
4. Verify a correct admin passphrase succeeds and a wrong passphrase fails.
5. Verify admin GitHub and scheduler actions reject missing or expired sessions.
6. Verify `index-now` rejects missing sessions, external URLs and non-article paths.
7. Verify Sports previews/reviews reject unknown match IDs and repeated uncached generation is rate-limited.

No production secrets are included in this repository.
