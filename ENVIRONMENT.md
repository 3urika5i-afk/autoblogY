# Environment Variables

## Worker (wrangler secrets/vars)
- `ALLOWED_ORIGINS` — CORS allow list (comma separated)
- `DEFAULT_TIMEZONE` — e.g. `UTC`
- `SITE_NAME` — Branding for emails
- `PUBLIC_URL` — https://yourdomain.com
- `GEMINI_API_KEY` — optional fallback for long-form generation

Bindings set in `wrangler.jsonc`:
- `DB` (D1)
- `MEDIA_BUCKET` (R2)
- `CACHE`, `RATELIMIT` (KV)
- `CONTENT_QUEUE`
- `ANALYTICS` dataset
- `EMAIL` send_email binding
- `AI` Workers AI binding

## Pages (frontend env)
- `NEXT_PUBLIC_API_URL` — URL of deployed Worker API
- `NEXT_PUBLIC_ADMIN_ACCESS_CODE` — fallback code for /admin (use Cloudflare Access in production)
