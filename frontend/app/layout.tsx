import './styles.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'AutoblogY',
  description: 'Autonomous Cloudflare-native autoblog'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-sand text-slate-900">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <header className="flex items-center justify-between border-b border-amber-200 pb-4">
            <div className="text-2xl font-bold tracking-tight">AutoblogY</div>
            <nav className="space-x-4 text-sm">
              <a href="/" className="hover:underline">Home</a>
              <a href="/install" className="hover:underline">Installer</a>
              <a href="/admin" className="hover:underline">Admin</a>
            </nav>
          </header>
          <main className="py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
