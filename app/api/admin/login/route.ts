// POST /api/admin/login   { pin: string }
//   - 성공: 204 + Set-Cookie(admin_session)
//   - 실패: 401
// 안전한 PIN 검증 (timing-safe). 무차별 대입 보호용 단순 지연도 추가.
import { NextResponse } from 'next/server';
import {
  verifyPin,
  buildSessionCookie,
  buildClearCookie,
  getCookieName,
} from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // process.env 접근 & 본 라우트는 가벼움 (Edge 도 가능하나 Node 로 고정)

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  let body: { pin?: string };
  try {
    body = (await req.json()) as { pin?: string };
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }
  const pin = (body?.pin ?? '').toString();
  if (!pin) return NextResponse.json({ error: 'PIN_REQUIRED' }, { status: 400 });

  const token = await verifyPin(pin);
  if (!token) {
    // 무차별 대입 완화 — 실패 시 300ms 지연.
    await sleep(300);
    return NextResponse.json({ error: 'INVALID_PIN' }, { status: 401 });
  }

  const res = new NextResponse(null, { status: 204 });
  res.headers.append('Set-Cookie', buildSessionCookie(token));
  return res;
}

export async function DELETE() {
  const res = new NextResponse(null, { status: 204 });
  res.headers.append('Set-Cookie', buildClearCookie());
  return res;
}

export async function GET(req: Request) {
  // 현재 세션 상태 확인용 (UI 가 헤더 표시할 때 사용).
  const cookieHeader = req.headers.get('cookie') ?? '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const i = c.indexOf('=');
      return i < 0 ? [c.trim(), ''] : [c.slice(0, i).trim(), c.slice(i + 1).trim()];
    })
  );
  const token = cookies[getCookieName()];
  const { verifySession } = await import('@/lib/auth/admin');
  const ok = await verifySession(token);
  return NextResponse.json({ authenticated: ok });
}
