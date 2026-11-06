import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import * as nodemailer from 'nodemailer';
import { emailQueue } from '../queue/connection';
import { encryptSmtpPassword } from '../utils/smtpCredentials';

const prisma = new PrismaClient();

const senderAccountSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  host: z.string().trim().min(1).max(255),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(512),
});

export async function getSenderAccountHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const account = await prisma.emailAccount.findFirst({
      where: { userId: res.locals.userId as string },
      select: { id: true, email: true, smtpHost: true, smtpPort: true, smtpUser: true },
    });
    res.json({ account });
  } catch (error) {
    next(error);
  }
}

export async function saveSenderAccountHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedBody = senderAccountSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: 'Enter a valid sender email, SMTP host, port, username, and password.' });
    return;
  }

  const { email, host, port, username, password } = parsedBody.data;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user: username, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  try {
    await transporter.verify();
  } catch {
    console.error('SMTP sender verification failed.');
    res.status(400).json({
      error: 'Could not connect to that SMTP server. Check the host, port, username, password, and provider SMTP settings.',
    });
    return;
  } finally {
    transporter.close();
  }

  try {
    const userId = res.locals.userId as string;
    const existingAccount = await prisma.emailAccount.findFirst({ where: { userId } });
    const conflictingAccount = await prisma.emailAccount.findUnique({ where: { email } });
    if (conflictingAccount && conflictingAccount.userId !== userId) {
      res.status(409).json({ error: 'That sender email is already connected to another account.' });
      return;
    }

    const accountData = {
      email,
      smtpHost: host,
      smtpPort: port,
      smtpUser: username,
      smtpPass: encryptSmtpPassword(password),
    };
    const account = existingAccount
      ? await prisma.emailAccount.update({
        where: { id: existingAccount.id },
        data: accountData,
        select: { id: true, email: true, smtpHost: true, smtpPort: true, smtpUser: true },
      })
      : await prisma.emailAccount.create({
        data: { ...accountData, userId },
        select: { id: true, email: true, smtpHost: true, smtpPort: true, smtpUser: true },
      });

    res.status(existingAccount ? 200 : 201).json({ account });
  } catch (error) {
    next(error);
  }
}

export async function scheduleCampaignHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { subject, body, delaySeconds, hourlyLimit, scheduledAt } = req.body;
    
    if (!req.file) {
      res.status(400).json({ error: 'Recipients destination vector file stream content empty.' });
      return;
    }

    const rawContent = req.file.buffer.toString('utf-8');
    const recipients = rawContent.split(/\r?\n/).map(line => line.trim()).filter(line => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line));

    if (recipients.length === 0) {
      res.status(400).json({ error: 'No valid recipient structural signatures isolated.' });
      return;
    }

    const userId = res.locals.userId as string;
    const primaryAccount = await prisma.emailAccount.findFirst({ where: { userId } });
    if (!primaryAccount) {
      res.status(400).json({ error: 'Connect a sending email account before scheduling a campaign.' });
      return;
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId, name: `Campaign-${Date.now()}`,
        subject, body, delaySeconds: Number(delaySeconds),
        hourlyLimit: Number(hourlyLimit), scheduledAt: new Date(scheduledAt),
      }
    });

    const delayMsBetweenSends = Number(delaySeconds) * 1000;
    const baseStartTime = new Date(scheduledAt).getTime();

    const transactionsArray = recipients.map((recipient, idx) => ({
      campaignId: campaign.id, emailAccountId: primaryAccount.id, recipient,
      status: 'SCHEDULED' as const, scheduledFor: new Date(baseStartTime + (idx * delayMsBetweenSends)),
    }));

    await prisma.email.createMany({ data: transactionsArray });
    const records = await prisma.email.findMany({ where: { campaignId: campaign.id } });

    for (const item of records) {
      const executionDelay = Math.max(0, item.scheduledFor.getTime() - Date.now());
      const job = await emailQueue.add('sendEmail', { emailId: item.id }, { delay: executionDelay, jobId: `idempotent-${item.id}` });
      await prisma.email.update({ where: { id: item.id }, data: { bullJobId: job.id } });
    }

    res.status(201).json({ success: true, count: recipients.length });
  } catch (error) { next(error); }
}

export async function fetchScheduledEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const list = await prisma.email.findMany({
      where: {
        status: { in: ['SCHEDULED', 'PENDING_RETRY'] },
        campaign: { userId: res.locals.userId as string },
      },
      include: { campaign: true },
      orderBy: { scheduledFor: 'asc' },
      take: 100,
    });
    res.json(list);
  } catch (error) { next(error); }
}

export async function fetchSentEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const list = await prisma.email.findMany({
      where: {
        status: { in: ['SENT', 'FAILED'] },
        campaign: { userId: res.locals.userId as string },
      },
      include: { campaign: true },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });
    res.json(list);
  } catch (error) { next(error); }
}

export async function searchAuditEngineHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (query.length > 200) {
      res.status(400).json({ error: 'Search query must be 200 characters or fewer.' });
      return;
    }

    if (!query) {
      res.json([]);
      return;
    }

    const matchingStatuses = ['SCHEDULED', 'PENDING_RETRY', 'SENT', 'FAILED'].filter((status) =>
      status.toLowerCase().includes(query.toLowerCase()),
    );
    const list = await prisma.email.findMany({
      where: {
        campaign: { userId: res.locals.userId as string },
        OR: [
          { recipient: { contains: query, mode: 'insensitive' } },
          { campaign: { subject: { contains: query, mode: 'insensitive' } } },
          { campaign: { body: { contains: query, mode: 'insensitive' } } },
          ...(matchingStatuses.length ? [{ status: { in: matchingStatuses as ('SCHEDULED' | 'PENDING_RETRY' | 'SENT' | 'FAILED')[] } }] : []),
        ],
      },
      include: { campaign: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(list);
  } catch (error) { next(error); }
}
