import { NextRequest, NextResponse } from 'next/server';

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const PUBLIC_PREFIXES = ['/login', '/api/auth'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow login page and auth API
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const secret    = process.env.APP_SECRET || 'default-secret-change-me';
  const passwords = (process.env.APP_PASSWORDS || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const sessionToken = req.cookies.get('marinduque_session')?.value;

  if (sessionToken && passwords.length > 0) {
    for (const pw of passwords) {
      const validToken = await sha256(`${secret}:${pw}`);
      if (sessionToken === validToken) {
        return NextResponse.next(); // ✅ authenticated
      }
    }
  }

  // Not authenticated — redirect to login, preserving the intended destination
  const loginUrl = new URL('/login', req.url);
  if (pathname !== '/') loginUrl.searchParams.set('from', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|images).*)'],
};
