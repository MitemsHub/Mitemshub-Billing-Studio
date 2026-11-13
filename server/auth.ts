import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Account, Client, Users } from 'node-appwrite';

const COOKIE_NAME = 'mitems_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const MAX_LOGIN_FAILURES = 8;

export interface SessionUser {
  email: string;
  name: string;
}

type SessionPayload = SessionUser & { exp: number };

function config() {
  return {
    endpoint: process.env.APPWRITE_ENDPOINT?.trim() || '',
    projectId: process.env.APPWRITE_PROJECT_ID?.trim() || '',
    apiKey: process.env.APPWRITE_API_KEY?.trim() || '',
  };
}

/** Login can only work when the browser-facing Appwrite project is configured. */
export function isAuthEnabled(): boolean {
  const { endpoint, projectId } = config();
  return Boolean(endpoint && projectId);
}

/**
 * Signing key. SESSION_SECRET takes precedence; otherwise it is derived from the
 * Appwrite API key so sessions survive restarts with no extra configuration.
 */
function signingKey(): Buffer {
  const source =
    process.env.SESSION_SECRET?.trim() || config().apiKey || 'mitems-local-development';
  return createHash('sha256').update(`mitems-session:${source}`).digest();
}

function sign(body: string): string {
  return createHmac('sha256', signingKey()).update(body).digest('base64url');
}

export function createSessionToken(user: SessionUser): string {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_MS / 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

function readCookie(header: string | undefined, name: string): string {
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return part.slice(separator + 1).trim();
    }
  }
  return '';
}

export function readSession(req: Request): SessionUser | null {
  const token = readCookie(req.headers.cookie, COOKIE_NAME);
  if (!token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return { email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * Verifies an email/password pair against Appwrite. Throws on bad credentials.
 *
 * Appwrite creates a real session for this check, so the session is revoked
 * before returning — otherwise every sign-in would leave an orphan behind until
 * it expired. The profile read and the revocation both use the server key, since
 * the SDK no longer returns the session secret needed to act as that user.
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<SessionUser> {
  const { endpoint, projectId, apiKey } = config();

  const session = await new Account(
    new Client().setEndpoint(endpoint).setProject(projectId)
  ).createEmailPasswordSession({ email, password });

  const users = new Users(
    new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey)
  );

  try {
    const user = await users.get({ userId: session.userId });
    return { email: user.email || email, name: user.name || user.email || email };
  } finally {
    // Best-effort: a failed revocation must not fail a login Appwrite accepted.
    await users
      .deleteSession({ userId: session.userId, sessionId: session.$id })
      .catch(() => undefined);
  }
}

const failures = new Map<string, { count: number; firstAt: number }>();

export function isLoginBlocked(key: string): boolean {
  const entry = failures.get(key);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    failures.delete(key);
    return false;
  }
  return entry.count >= MAX_LOGIN_FAILURES;
}

export function noteLoginFailure(key: string): void {
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    failures.set(key, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}

/** Guards every data route. When Appwrite is unconfigured the app stays local-only. */
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!isAuthEnabled() || readSession(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'Authentication required.' });
}
