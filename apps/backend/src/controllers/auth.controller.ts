import { Request, Response, NextFunction } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { ENV } from '../config/environment';
import { sessionCookieName } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000;
const sessionOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
const passwordSchema = z.string().min(8).max(128);
const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: passwordSchema,
});
const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

function hashPassword(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function createPasswordHash(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await hashPassword(password, salt);
  return `${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

const dummyPasswordHash = createPasswordHash('password-hash-timing-check');

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [encodedSalt, encodedHash] = storedHash.split(':');
  if (!encodedSalt || !encodedHash) return false;

  const salt = Buffer.from(encodedSalt, 'base64url');
  const expectedHash = Buffer.from(encodedHash, 'base64url');
  if (salt.length !== 16 || expectedHash.length !== 64) return false;

  const actualHash = await hashPassword(password, salt);
  return timingSafeEqual(actualHash, expectedHash);
}

function createSession(userId: string): string {
  return jwt.sign(
    { sub: userId },
    ENV.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '7d',
      issuer: 'reachinbox',
      audience: 'reachinbox-web',
    },
  );
}

function setSessionCookie(res: Response, userId: string): void {
  res.cookie(sessionCookieName, createSession(userId), {
    ...sessionOptions,
    maxAge: sessionDurationMs,
  });
}

export async function signupHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedBody = signupSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: 'Enter your name, a valid email address, and a password with at least 8 characters.' });
    return;
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: parsedBody.data.email,
        name: parsedBody.data.name,
        passwordHash: await createPasswordHash(parsedBody.data.password),
      },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    setSessionCookie(res, user.id);
    res.status(201).json({ user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
      return;
    }
    next(error);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedBody = loginSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: 'Enter a valid email address and a password with at least 8 characters.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsedBody.data.email },
    });
    const storedHash = user?.passwordHash ?? await dummyPasswordHash;
    const passwordMatches = await verifyPassword(parsedBody.data.password, storedHash);

    if (!user || !passwordMatches) {
      res.status(401).json({ error: 'Email or password is incorrect.' });
      return;
    }

    setSessionCookie(res, user.id);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentUserHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: res.locals.userId as string },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });

    if (!user) {
      res.clearCookie(sessionCookieName, sessionOptions);
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
      return;
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
}

export function logoutHandler(_req: Request, res: Response): void {
  res.clearCookie(sessionCookieName, sessionOptions);
  res.status(204).end();
}
