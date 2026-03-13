# Deployment Guide (Cloudflare-first)

Prereqs: Cloudflare account with domain on CF nameservers, Wrangler CLI (`npm i -g wrangler`), Node 20+, bun (for worker scripts), git.

## 1) Provision resources
1. Create D1: `wrangler d1 create autoblog-d1`
2. Create KV namespaces: `wrangler kv:namespace create autoblog-cache` and `wrangler kv:namespace create autoblog-ratelimit`. Set the ids in `workers/api/wrangler.jsonc`.
3. Create R2 bucket: `wrangler r2 bucket create autoblog-media`.
4. Create Queue: `wrangler queues create autoblog-content`.
5. Create Analytics dataset: `wrangler analytics create autoblog-analytics`.
6. Enable Email Routing + create Worker sender binding named `EMAIL`.

## 2) Configure wrangler secrets (Worker)
In `workers/api`: run `wrangler secret put GEMINI_API_KEY` (optional for fallback) and any third-party keys.

## 3) Apply D1 schema
`wrangler d1 execute autoblog-d1 --file=../../schema/schema.sql`

## 4) Deploy Worker API
```
cd workers/api
bun install
bun run deploy
```
Note the production Worker URL; set as `NEXT_PUBLIC_API_URL` secret for Pages.

## 5) Deploy Cloudflare Pages (Next.js)
```
cd frontend
npm install
npm run lint
npm run build
npx wrangler pages deploy .vercel/output/static --project-name=autoblog-pages
```
Set environment variables in Pages project:
- `NEXT_PUBLIC_API_URL` = Worker URL
- `NEXT_PUBLIC_ADMIN_ACCESS_CODE` = temporary fallback code (prefer Access SSO)

## 6) Cron + Queue
Cron is defined in wrangler (`0 */6 * * *`). Ensure Queue consumer uses same binding (auto from deploy). No extra steps.

## 7) GitHub Actions
Add repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_API_URL`.

## 8) DNS / Routing
Point domain to CF. Create route for Worker if using a subdomain (e.g., api.example.com/*). Pages custom domain set via CF Pages dashboard.

## 9) First-run Installer
Visit `/install` on the Pages site, enter domain + choices, run Deploy. This writes settings into D1 and starts the content queue.

## 10) Upgrade path
- Hit free limits? Upgrade AI calls (Workers AI >= paid), R2 beyond 10GB, Queue throughput. D1 remains SQLite-compatible; migrate to Turso/Neon if needed by adding HTTP fetch adapter.

## Hardening for production
- Enable Cloudflare Access on `/admin/*`; middleware already honors `CF-Access-Authenticated-User-Email`.
- Rotate `NEXT_PUBLIC_ADMIN_ACCESS_CODE` after first login; treat as temporary.
- Add monitoring: Worker health check `/health`, queue failure logs, AI fallbacks.
