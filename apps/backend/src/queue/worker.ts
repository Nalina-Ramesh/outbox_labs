import { Worker, Job } from 'bullmq';
import { redisConnection, emailQueue } from './connection';
import { PrismaClient } from '@prisma/client';
import { checkSenderRateLimit, shouldFireSlackAlert } from '../services/rateLimiter';
import { dispatchSlackRateLimitAlert } from '../services/slackService';
import { indexEmailToElasticsearch } from '../services/searchService';
import * as nodemailer from 'nodemailer';
import { ENV } from '../config/environment';
import { decryptSmtpPassword } from '../utils/smtpCredentials';

const prisma = new PrismaClient();

export const emailWorker = new Worker(
  'email-outbound-queue',
  async (job: Job) => {
    const { emailId } = job.data;
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { campaign: true, emailAccount: true },
    });

    if (!email || email.status === 'SENT') return;

    const check = await checkSenderRateLimit(email.emailAccountId, email.campaign.hourlyLimit);
    if (!check.allowed) {
      const delayMs = check.retryAfterSeconds * 1000;
      if (await shouldFireSlackAlert(email.emailAccountId)) {
        await dispatchSlackRateLimitAlert(email.campaign.userId, email.emailAccount.email, email.campaign.hourlyLimit);
      }

      const newJob = await emailQueue.add(
        'sendEmail',
        { emailId: email.id },
        { delay: delayMs, jobId: `retry-${email.id}-${Date.now()}` }
      );

      await prisma.email.update({
        where: { id: email.id },
        data: { status: 'PENDING_RETRY', bullJobId: newJob.id },
      });
      throw new Error(`Rate limit hit. Postponing execution sequence.`);
    }

    await new Promise((resolve) => setTimeout(resolve, email.campaign.delaySeconds * 1000));

    const transporter = nodemailer.createTransport({
      host: email.emailAccount.smtpHost,
      port: email.emailAccount.smtpPort,
      secure: email.emailAccount.smtpPort === 465,
      auth: {
        user: email.emailAccount.smtpUser,
        pass: decryptSmtpPassword(email.emailAccount.smtpPass),
      },
    });

    try {
      await transporter.sendMail({
        from: email.emailAccount.email,
        to: email.recipient,
        subject: email.campaign.subject,
        text: email.campaign.body,
      });

      const updated = await prisma.email.update({
        where: { id: email.id },
        data: { status: 'SENT', sentAt: new Date() },
      });

      await indexEmailToElasticsearch({
        id: updated.id, recipient: updated.recipient, sender: email.emailAccount.email,
        subject: email.campaign.subject, status: 'SENT', sentAt: updated.sentAt
      });
    } catch (err: any) {
      const updated = await prisma.email.update({
        where: { id: email.id },
        data: { status: 'FAILED', errorMessage: err.message },
      });
      await indexEmailToElasticsearch({
        id: updated.id, recipient: updated.recipient, sender: email.emailAccount.email,
        subject: email.campaign.subject, status: 'FAILED', sentAt: null
      });
      throw err;
    }
  },
  { connection: redisConnection, concurrency: ENV.WORKER_CONCURRENCY }
);
