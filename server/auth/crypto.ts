import crypto from 'node:crypto';
import type { PublicUser, UserRole } from '../types';

const DEFAULT_SECRET = 'doctor-tracker-dev-secret-change-in-production';

function getAuthSecret(): string {
  return process.env.AUTH_SECRET || DEFAULT_SECRET;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;

  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;

  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + '='.repeat(padLength), 'base64').toString('utf8');
}

export function signAuthToken(user: PublicUser, ttlSeconds = 60 * 60 * 24 * 7): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${header}.${encodedPayload}`;
  const signature = base64UrlEncode(
    crypto.createHmac('sha256', getAuthSecret()).update(data).digest()
  );
  return `${data}.${signature}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payloadB64, signatureB64] = parts;
  if (!header || !payloadB64 || !signatureB64) return null;

  const data = `${header}.${payloadB64}`;
  const expectedSig = base64UrlEncode(
    crypto.createHmac('sha256', getAuthSecret()).update(data).digest()
  );

  const actualBuf = Buffer.from(signatureB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (actualBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(actualBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(payloadB64)) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!parsed.sub || !parsed.email || typeof parsed.exp !== 'number') return null;
    if (parsed.exp <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}
