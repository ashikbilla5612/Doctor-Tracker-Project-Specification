import { Router, type Request, type Response } from 'express';
import { hashPassword, signAuthToken, verifyPassword } from '../auth/crypto';
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware';
import { store } from '../db/store';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const user = store.findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const { passwordHash: _, ...publicUser } = user;
  const token = signAuthToken(publicUser);

  res.cookie('dt_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });

  res.json({ token, user: publicUser });
});

authRouter.post('/register', (req: Request, res: Response) => {
  const { name, email, password } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters.' });
    return;
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  try {
    const publicUser = store.createUser({
      name: name.trim(),
      email: email.trim(),
      passwordHash: hashPassword(password),
    });
    const token = signAuthToken(publicUser);

    res.cookie('dt_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(201).json({ token, user: publicUser });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to create account.';
    res.status(409).json({ error: message });
  }
});

authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user ? store.findUserById(req.user.sub) : null;
  if (!user) {
    res.status(401).json({ error: 'User account not found.' });
    return;
  }
  res.json({ user });
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('dt_token', { path: '/' });
  res.json({ ok: true });
});
