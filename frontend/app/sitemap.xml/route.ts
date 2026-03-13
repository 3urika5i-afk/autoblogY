import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${api}/articles?limit=200`);
  const data = await res.json();
  const items = (data.articles || []) as Array<{ slug: string; published_at: string }>;
  const base = (api || '').replace(/\/?api.*/, '');
  const urls = items
    .map((a) => `<url><loc>${base}/articles/${a.slug}</loc><lastmod>${a.published_at}</lastmod></url>`)
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
  return new NextResponse(xml, { status: 200, headers: { 'content-type': 'application/xml' } });
}
