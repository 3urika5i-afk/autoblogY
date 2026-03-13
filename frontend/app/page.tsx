'use client';
import { useEffect, useState } from 'react';

type Article = { id: string; title: string; slug: string; summary: string; hero_image: string; published_at: string };

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/articles?limit=12`).then((r) => r.json());
      setArticles(res.articles || []);
    };
    load();
  }, []);

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
      {articles.map((a) => (
        <article key={a.id} className="card">
          <div className="badge">{new Date(a.published_at).toLocaleDateString()}</div>
          <h3 style={{ marginTop: 8 }}>
            <a href={`/articles/${a.slug}`}>{a.title}</a>
          </h3>
          <p>{a.summary}</p>
          <a className="btn" style={{ marginTop: 12 }} href={`/articles/${a.slug}`}>
            Read →
          </a>
        </article>
      ))}
      {!articles.length && <div className="card">No articles yet. Run the installer to seed content.</div>}
    </div>
  );
}
