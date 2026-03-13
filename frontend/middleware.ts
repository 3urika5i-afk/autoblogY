import { NextResponse, type NextRequest } from 'next/server';

export const config = { matcher: ['/admin/:path*'] };

export function middleware(req: NextRequest) {
  const email = req.headers.get('cf-access-authenticated-user-email');
  if (email) return NextResponse.next();
  const cookie = req.cookies.get('admin_code');
  if (cookie && cookie.value === process.env.NEXT_PUBLIC_ADMIN_ACCESS_CODE) return NextResponse.next();
  return NextResponse.redirect(new URL('/install', req.url));
}
