import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/environment';

export const sessionCookieName = 'reachinbox_session';

function readSessionCookie(req: Request): string | undefined {
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));

  if (!cookie) return undefined;
  try {
    return decodeURIComponent(cookie.slice(sessionCookieName.length + 1));
  } catch {
    return undefined;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = readSessionCookie(req);
  if (!token) {
    res.status(401).json({ error: 'Please sign in to continue.' });
    return;
  }

  try {
    const claims = jwt.verify(token, ENV.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'reachinbox',
      audience: 'reachinbox-web',
    });

    if (typeof claims === 'string' || typeof claims.sub !== 'string') {
      res.clearCookie(sessionCookieName, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      });
      res.status(401).json({ error: 'Your session is invalid. Please sign in again.' });
      return;
    }

    res.locals.userId = claims.sub;
  } catch {
    res.clearCookie(sessionCookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    return;
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin !== ENV.FRONTEND_ORIGIN) {
      res.status(403).json({ error: 'Request origin is not allowed.' });
      return;
    }
  }

  next();
}