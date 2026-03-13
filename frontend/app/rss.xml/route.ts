import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const api = process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${api}/articles?limit=50`);
  const data = await res.json();
  const items = (data.articles || []) as Array<{ title: string; slug: string; summary: string; published_at: string }>;
  const base = (api || '').replace(/\/?api.*/, '');
  const feedItems = items
    .map(
      (a) => `
      <item>
        <title><![CDATA[${a.title}]]></title>
        <link>${base}/articles/${a.slug}</link>
        <guid isPermaLink="true">${base}/articles/${a.slug}</guid>
        <pubDate>${new Date(a.published_at).toUTCString()}</pubDate>
        <description><![CDATA[${a.summary || ''}]]></description>
      </item>`
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>AutoblogY</title>
      <link>${base}</link>
      <description>Autonomous niche autoblog</description>
      ${feedItems}
    </channel>
  </rss>`;

  return new NextResponse(xml, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
}
