import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

export const SESSION_COOKIE = 'ai_demo_session';
const SESSION_TTL_SECONDS = 60 * 60;

type SessionPayload = {
  sid: string;
  exp: number;
};

function requiredEnv(name: 'DEMO_ACCESS_CODE' | 'SESSION_SECRET') {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  if (name === 'DEMO_ACCESS_CODE' && value.length < 16) {
    throw new Error('DEMO_ACCESS_CODE must contain at least 16 characters');
  }
  if (name === 'SESSION_SECRET' && value.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters');
  }
  return value;
}

function equalSecret(left: string, right: string) {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function sign(payload: string) {
  return createHmac('sha256', requiredEnv('SESSION_SECRET'))
    .update(payload)
    .digest('base64url');
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;

  for (const item of cookie.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return value.join('=');
  }

  return null;
}

export function isValidAccessCode(accessCode: string) {
  return equalSecret(accessCode, requiredEnv('DEMO_ACCESS_CODE'));
}

export function createSession() {
  const session: SessionPayload = {
    sid: randomUUID(),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSession(request: Request): SessionPayload | null {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature || !equalSecret(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as SessionPayload;

    if (!session.sid || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function expiredSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function safetyIdentifier(sessionId: string) {
  return createHash('sha256')
    .update(`ai-streaming-demo:${sessionId}`)
    .digest('hex');
}
