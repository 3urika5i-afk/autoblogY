import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';

type ContentJob =
  | { type: 'GENERATE_ARTICLE'; calendarId: string }
  | { type: 'WEEKLY_DIGEST' };

type Env = {
  DB: D1Database;
  CACHE: KVNamespace;
  RATELIMIT: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  CONTENT_QUEUE: Queue<ContentJob>;
  AI: Ai;
  ANALYTICS: AnalyticsEngineDataset;
  EMAIL: SendEmail;
  GEMINI_API_KEY?: string;
  ALLOWED_ORIGINS: string;
  DEFAULT_TIMEZONE: string;
  SITE_NAME: string;
  PUBLIC_URL: string;
};

const app = new Hono<{ Bindings: Env }>();
app.use('*', cors({ origin: (c) => c.env.ALLOWED_ORIGINS.split(',') }));

// Simple KV-based rate limiter (60 req / 5 minutes / IP)
async function rateLimit(c: any) {
  const ip = c.req.header('cf-connecting-ip') || 'anonymous';
  const key = `rl:${ip}`;
  const current = Number((await c.env.RATELIMIT.get(key)) || '0');
  if (current > 60) return c.json({ error: 'rate_limited' }, 429);
  await c.env.RATELIMIT.put(key, String(current + 1), { expirationTtl: 300 });
  return null;
}

// Schemas
const installerSchema = z.object({
  domain: z.string().min(4),
  niches: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      searchVolume: z.string(),
      affiliateScore: z.number().min(1).max(10),
      competition: z.enum(['Low', 'Medium', 'High']),
      monetisationPer10k: z.number(),
      reasoning: z.string()
    })
  ),
  selectedNiche: z.string(),
  personas: z.array(
    z.object({
      name: z.string(),
      demographics: z.string(),
      psychographics: z.string(),
      behaviour: z.string(),
      optimalTimes: z.string()
    })
  ),
  volume: z.object({
    articlesPerWeek: z.number(),
    photosPerArticle: z.number(),
    videoMode: z.enum(['none', 'short', 'long'])
  }),
  monetisation: z.object({
    affiliates: z.array(z.string()),
    ads: z.string(),
    email: z.boolean(),
    products: z.array(z.string()),
    sponsored: z.boolean()
  }),
  apiKeys: z.record(z.string()).optional()
});

app.get('/health', (c) => c.text('ok'));

app.get('/articles', async (c) => {
  const slug = c.req.query('slug');
  if (slug) {
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, slug, summary, body, published_at, hero_image, schema_json FROM articles WHERE slug = ?1`
    )
      .bind(slug)
      .all();
    return c.json({ articles: results });
  }
  const limit = Number(c.req.query('limit') || '20');
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, slug, summary, published_at, hero_image FROM articles WHERE status = 'published' ORDER BY published_at DESC LIMIT ?`
  )
    .bind(limit)
    .all();
  return c.json({ articles: results });
});

app.get('/calendar', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, target_keyword, publish_at, status FROM content_calendar ORDER BY publish_at ASC`
  ).all();
  return c.json({ calendar: results });
});

app.get('/media/:key', async (c) => {
  const key = c.req.param('key');
  const obj = await c.env.MEDIA_BUCKET.get(key);
  if (!obj) return c.notFound();
  return new Response(obj.body, { headers: { 'content-type': obj.httpMetadata?.contentType || 'image/jpeg' } });
});

app.post('/installer/bootstrap', async (c) => {
  const rl = await rateLimit(c);
  if (rl) return rl;
  const body = await c.req.json();
  const parsed = installerSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.format() }, 400);
  const data = parsed.data;

  const tx = c.env.DB.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`
  );
  await tx.bind('domain', data.domain).run();
  await tx.bind('selectedNiche', data.selectedNiche).run();
  await tx.bind('volume', JSON.stringify(data.volume)).run();
  await tx.bind('monetisation', JSON.stringify(data.monetisation)).run();
  await tx.bind('personas', JSON.stringify(data.personas)).run();
  await tx.bind('niches', JSON.stringify(data.niches)).run();
  if (data.apiKeys) await tx.bind('apiKeys', JSON.stringify(data.apiKeys)).run();

  // seed first 14 days calendar placeholders
  const now = Date.now();
  const entries: Array<[string, string, number]> = [];
  for (let i = 0; i < 14; i++) {
    entries.push([
      crypto.randomUUID(),
      data.selectedNiche,
      now + i * (86400000 / Math.max(1, data.volume.articlesPerWeek / 7))
    ]);
  }
  const stmt = c.env.DB.prepare(
    `INSERT INTO content_calendar (id, target_keyword, publish_at, status) VALUES (?1, ?2, datetime(?3/1000,'unixepoch'), 'scheduled')`
  );
  for (const [id, kw, ts] of entries) await stmt.bind(id, kw, ts).run();

  return c.json({ ok: true, seeded: entries.length });
});

app.post('/articles/generate', async (c) => {
  const rl = await rateLimit(c);
  if (rl) return rl;
  const { calendarId } = await c.req.json<{ calendarId: string }>();
  if (!calendarId) return c.json({ error: 'calendarId required' }, 400);
  await c.env.CONTENT_QUEUE.send({ type: 'GENERATE_ARTICLE', calendarId });
  return c.json({ queued: true });
});

// Simple A/B endpoint for CTA copy; deterministic by IP hash
app.get('/ab/cta', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || 'anon';
  const bucket = hashToVariant(ip);
  await bumpMetric(c.env.CACHE, `ab:cta:${bucket}:impressions`);
  const copy = bucket === 'A' ? 'Get weekly value-packed briefs →' : 'Subscribe for 1-click trip plans →';
  return c.json({ variant: bucket, copy });
});

// Scheduled cron: enqueue due content and weekly digest
export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    const now = new Date();
    const { results } = await env.DB.prepare(
      `SELECT id FROM content_calendar WHERE status='scheduled' AND publish_at <= datetime('now') LIMIT 20`
    ).all();
    for (const row of results as Array<{ id: string }>) {
      ctx.waitUntil(env.CONTENT_QUEUE.send({ type: 'GENERATE_ARTICLE', calendarId: row.id }));
    }
    if (now.getUTCDay() === 0 && now.getUTCHours() < 1) {
      ctx.waitUntil(env.CONTENT_QUEUE.send({ type: 'WEEKLY_DIGEST' }));
    }
  },
  queue: async (batch: MessageBatch<ContentJob>, env: Env, ctx: ExecutionContext) => {
    for (const message of batch.messages) {
      try {
        if (message.body.type === 'GENERATE_ARTICLE') {
          await handleGenerateArticle(env, ctx, message.body.calendarId);
        }
        if (message.body.type === 'WEEKLY_DIGEST') {
          await sendWeeklyDigest(env, ctx);
        }
      } catch (err) {
        console.error('Queue handler error', err);
        // retry with small delay; Queue will stop after max deliveries
        message.retry({ delaySeconds: 300 });
      }
    }
  }
};

async function handleGenerateArticle(env: Env, ctx: ExecutionContext, calendarId: string) {
  const calendar = await env.DB.prepare(
    `SELECT * FROM content_calendar WHERE id = ?1`
  )
    .bind(calendarId)
    .first();
  if (!calendar) return;

  const settings = await env.DB.prepare(`SELECT key, value FROM settings`).all();
  const settingsMap = Object.fromEntries(settings.results.map((r: any) => [r.key, r.value]));
  const personas = JSON.parse(settingsMap.personas || '[]');
  const monetisation = JSON.parse(settingsMap.monetisation || '{}');

  const brief = await buildBrief(env, calendar.target_keyword, personas);
  const article = await generateLongform(env, brief);
  article.body = injectAffiliateLinks(article.body, monetisation);
  article.body = await injectInternalLinks(env, article.body, article.slug);

  await env.DB.prepare(
    `INSERT INTO articles (id, title, slug, summary, body, status, published_at, hero_image, meta, schema_json)
     VALUES (?1, ?2, ?3, ?4, ?5, 'published', datetime('now'), ?6, ?7, ?8)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, summary=excluded.summary, body=excluded.body, status='published', hero_image=excluded.hero_image, meta=excluded.meta, schema_json=excluded.schema_json`
  )
    .bind(
      crypto.randomUUID(),
      article.title,
      article.slug,
      article.summary,
      article.body,
      article.heroImage,
      JSON.stringify(article.meta),
      JSON.stringify(article.schema)
    )
    .run();

  await env.DB.prepare(
    `UPDATE content_calendar SET status='published', published_article_id=(SELECT id FROM articles WHERE slug=?1 LIMIT 1) WHERE id=?2`
  )
    .bind(article.slug, calendarId)
    .run();

  ctx.waitUntil(generateHeroImage(env, article));
  ctx.waitUntil(trackAnalytics(env, 'publish', { calendarId, slug: article.slug }));
  ctx.waitUntil(sendMilestoneEmail(env, article.title));
  ctx.waitUntil(pingSitemaps(env));
}

async function buildBrief(env: Env, keyword: string, personas: any[]) {
  const prompt = `Generate a detailed SEO brief for keyword "${keyword}" including: secondary keywords, search intent, recommended word count, affiliate placement suggestions, meta description template, outline with H2/H3.`;
  const res = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages: [{ role: 'user', content: prompt }] });
  const text = (res as any).response || JSON.stringify(res);
  return { keyword, personas, raw: text };
}

async function generateLongform(env: Env, brief: any) {
  const system = `You are an expert niche blogger. Enforce E-E-A-T, cite reputable sources, readability >= 60, include actionable steps and data points.`;
  const prompt = `${brief.raw}\nWrite a full article with title, slug, summary (max 155 chars), body in HTML, hero image prompt, meta (description, ogTitle, ogDescription), FAQ schema items.`;
  let text: any;
  try {
    text = await env.AI.run('@cf/meta/llama-3-70b-instruct', { messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] });
  } catch (err) {
    // fallback to Gemini Flash
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + env.GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: system + '\n' + prompt }] }] })
    });
    text = await resp.json();
  }
  const raw = (text as any).response || (text as any).candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(text);
  // naive parse; in production ensure structured JSON
  const titleMatch = raw.match(/TITLE:(.*)/i);
  const title = titleMatch ? titleMatch[1].trim() : `How to ${brief.keyword}`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const heroImage = `og-${slug}.png`;
  const summary = raw.slice(0, 155);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description: summary,
    mainEntityOfPage: `${env.PUBLIC_URL}/articles/${slug}`
  };
  const meta = {
    description: summary,
    ogTitle: title,
    ogDescription: summary,
    ogImage: `${env.PUBLIC_URL}/media/${heroImage}`
  };
  const heroPrompt = `Hero image for ${title} with high contrast, editorial, 16:9`;
  return { title, slug, summary, body: raw, heroImage, heroPrompt, meta, schema };
}

async function sendWeeklyDigest(env: Env, ctx: ExecutionContext) {
  const { results } = await env.DB.prepare(
    `SELECT title, slug FROM articles WHERE status='published' AND published_at >= datetime('now', '-7 days')`
  ).all();
  const list = results as Array<{ title: string; slug: string }>;
  if (!list.length) return;
  const subscribers = await env.DB.prepare(`SELECT email FROM subscribers WHERE status='active'`).all();
  for (const sub of subscribers.results as Array<{ email: string }>) {
    ctx.waitUntil(
      env.EMAIL.send({
        to: sub.email,
        from: `AutoblogY <no-reply@${new URL(env.PUBLIC_URL).hostname}>`,
        subject: `Your weekly digest from ${env.SITE_NAME}`,
        content: {
          type: 'text/html',
          value: `Here is what we published this week:<ul>${list
            .map((a) => `<li><a href="${env.PUBLIC_URL}/articles/${a.slug}">${a.title}</a></li>`)
            .join('')}</ul>`
        }
      })
    );
  }
}

async function sendMilestoneEmail(env: Env, title: string) {
  await env.EMAIL.send({
    to: `owner@${new URL(env.PUBLIC_URL).hostname}`,
    from: `AutoblogY <no-reply@${new URL(env.PUBLIC_URL).hostname}>`,
    subject: `New article published: ${title}`,
    content: { type: 'text/plain', value: `Your site just published: ${title}` }
  });
}

async function trackAnalytics(env: Env, event: string, props: Record<string, unknown>) {
  await env.ANALYTICS.writeDataPoint({
    blobs: [event],
    doubles: [],
    indexes: [props.slug as string | undefined].filter(Boolean) as string[],
    ints: [Date.now()]
  });
}

function hashToVariant(ip: string) {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) hash = (hash << 5) - hash + ip.charCodeAt(i);
  return Math.abs(hash % 2) === 0 ? 'A' : 'B';
}

async function bumpMetric(kv: KVNamespace, key: string) {
  const current = Number((await kv.get(key)) || '0');
  await kv.put(key, String(current + 1), { expirationTtl: 60 * 60 * 24 * 30 });
}

function injectAffiliateLinks(html: string, monetisation: any) {
  if (!monetisation?.affiliates?.length) return html;
  // very light-touch: wrap first occurrence of each affiliate keyword
  const keywords = monetisation.affiliates.slice(0, 5);
  let out = html;
  for (const kw of keywords) {
    const pattern = new RegExp(`(${kw.split(' ')[0]})`, 'i');
    out = out.replace(pattern, `<a href=\"#aff-${slugify(kw)}\" rel=\"nofollow sponsored\" target=\"_blank\">$1</a>`);
  }
  return out;
}

async function injectInternalLinks(env: Env, html: string, slug: string) {
  const { results } = await env.DB.prepare(
    `SELECT title, slug FROM articles WHERE status='published' ORDER BY published_at DESC LIMIT 5`
  ).all();
  const links = (results as Array<{ title: string; slug: string }>).filter((r) => r.slug !== slug).slice(0, 3);
  if (!links.length) return html;
  const list = links.map((l) => `<li><a href=\"/articles/${l.slug}\">${l.title}</a></li>`).join('');
  return `${html}<section><h3>Related reading</h3><ul>${list}</ul></section>`;
}

async function generateHeroImage(env: Env, article: any) {
  try {
    const prompt = article.heroPrompt || `High quality photo for ${article.title}`;
    const ai = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt,
      num_steps: 25
    });
    const bytes = (ai as any).image || new Uint8Array();
    await env.MEDIA_BUCKET.put(article.heroImage, bytes);
  } catch (err) {
    const resp = await fetch('https://picsum.photos/seed/' + article.slug + '/1200/630');
    const arrayBuf = await resp.arrayBuffer();
    await env.MEDIA_BUCKET.put(article.heroImage, arrayBuf);
  }
  await env.DB.prepare(
    `INSERT INTO images (id, article_id, url, alt) VALUES (?1, (SELECT id FROM articles WHERE slug=?2 LIMIT 1), ?3, ?4)`
  )
    .bind(crypto.randomUUID(), article.slug, `/media/${article.heroImage}`, article.heroPrompt || article.title)
    .run();
}

async function pingSitemaps(env: Env) {
  const sitemapUrl = `${env.PUBLIC_URL}/sitemap.xml`;
  const endpoints = [
    `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`
  ];
  await Promise.all(endpoints.map((u) => fetch(u).catch(() => null)));
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
