'use client';
import { useEffect, useState } from 'react';

type Stat = { label: string; value: string };

export default function AdminPage() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [calendar, setCalendar] = useState<any[]>([]);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const code = localStorage.getItem('admin_code');
    if (code && code === process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE) {
      setAuthorized(true);
      document.cookie = `admin_code=${code}; path=/; SameSite=Lax`;
      return;
    }
    const input = prompt('Admin access code');
    if (input === process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE) {
      localStorage.setItem('admin_code', input || '');
      document.cookie = `admin_code=${input}; path=/; SameSite=Lax`;
      setAuthorized(true);
    }
  }, []);

  useEffect(() => {
    if (!authorized) return;
    const load = async () => {
      const [articlesRes, calRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/articles?limit=5`).then((r) => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/calendar`).then((r) => r.json())
      ]);
      setStats([
        { label: 'Published articles', value: String(articlesRes.articles?.length || 0) },
        { label: 'Calendar items', value: String(calRes.calendar?.length || 0) }
      ]);
      setCalendar(calRes.calendar || []);
    };
    load();
  }, [authorized]);

  if (!authorized) return <div className="card">Access denied. Use Cloudflare Access for production.</div>;

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="badge">{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Content Calendar</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Publish at</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {calendar.map((c: any) => (
              <tr key={c.id}>
                <td>{c.target_keyword}</td>
                <td>{c.publish_at}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
