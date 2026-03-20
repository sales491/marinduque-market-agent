import { NextRequest, NextResponse } from 'next/server';

async function sha256(message: string): Promise<string> {
  const data = new TextEncoder().encode(message);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  const secret    = process.env.APP_SECRET || 'default-secret-change-me';
  const passwords = (process.env.APP_PASSWORDS || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const matched = passwords.find((p) => p === password);

  if (!matched) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = await sha256(`${secret}:${matched}`);

  const res = NextResponse.json({ ok: true });
  res.cookies.set('marinduque_session', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30, // 30 days
    path:     '/',
  });
  return res;
}
