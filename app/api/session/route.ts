import {
  createSession,
  expiredSessionCookie,
  isValidAccessCode,
  readSession,
  sessionCookie,
} from '@/lib/auth';
import {
  acquireRequestSlot,
  clientAddress,
  isSameOrigin,
} from '@/lib/request-guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }
  return Response.json({ authenticated: Boolean(readSession(request)) });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }

  const slot = acquireRequestSlot(`login:${clientAddress(request)}`);
  if (!slot.allowed) {
    return Response.json(
      { error: 'Too many sign-in attempts' },
      { status: 429, headers: { 'Retry-After': String(slot.retryAfter) } },
    );
  }

  try {
    const { accessCode } = (await request.json()) as { accessCode?: string };
    if (!accessCode || accessCode.length > 256 || !isValidAccessCode(accessCode)) {
      return Response.json({ error: 'Invalid access code' }, { status: 401 });
    }

    return Response.json(
      { authenticated: true },
      { headers: { 'Set-Cookie': sessionCookie(createSession()) } },
    );
  } catch {
    return Response.json({ error: 'Could not create session' }, { status: 500 });
  } finally {
    slot.release();
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  }

  return Response.json(
    { authenticated: false },
    { headers: { 'Set-Cookie': expiredSessionCookie() } },
  );
}
