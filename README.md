# autoblogY

Cloudflare-native autonomous autoblog with installer, Worker backend, Next.js Pages frontend, D1/R2/KV/Queues/Email/Analytics integration.

Key paths:
- `workers/api` — Cloudflare Worker API + cron + queue consumer
- `frontend` — Next.js app for Pages (installer, blog, admin)
- `schema/schema.sql` — D1 schema
- `DEPLOYMENT.md` — step-by-step deploy guide
