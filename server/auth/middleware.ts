import type { NextFunction, Request, Response } from 'express';
import { verifyAuthToken, type TokenPayload } from './crypto';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
      const [key, ...rest] = cookie.trim().split('=');
      if (key === 'dt_token') {
        return decodeURIComponent(rest.join('='));
      }
    }
  }
  return null;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
    return;
  }

  req.user = payload;
  next();
}
