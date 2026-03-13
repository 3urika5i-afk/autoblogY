'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Article = { title: string; body: string; summary: string; published_at: string; schema_json?: string };

export default function ArticlePage() {
  const params = useParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/articles?slug=${params.slug}`).then((r) => r.json());
      setArticle(res.articles?.[0] || null);
    };
    load();
  }, [params.slug]);

  if (!article) return <div className="card">Loading…</div>;

  return (
    <article className="card">
      <div className="badge">{new Date(article.published_at).toLocaleString()}</div>
      <h1>{article.title}</h1>
      <p className="muted">{article.summary}</p>
      <div dangerouslySetInnerHTML={{ __html: article.body }} />
    </article>
  );
}
