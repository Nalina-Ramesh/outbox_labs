import { PrismaClient } from '@prisma/client';
import { emailQueue } from './connection';

const prisma = new PrismaClient();

export async function synchronizeSchedulerState() {
  console.log('🔄 Reconciling database state with BullMQ...');

  const activeScheduledEmails = await prisma.email.findMany({
    where: { status: { in: ['SCHEDULED', 'PENDING_RETRY'] } }
  });

  for (const email of activeScheduledEmails) {
    if (email.bullJobId) {
      const job = await emailQueue.getJob(email.bullJobId);
      if (job) {
        const state = await job.getState();
        if (state === 'delayed' || state === 'waiting' || state === 'active') {
          continue;
        }
      }
    }

    const delay = Math.max(0, email.scheduledFor.getTime() - Date.now());
    const job = await emailQueue.add(
      'sendEmail',
      { emailId: email.id },
      { delay, jobId: `resync-${email.id}` }
    );

    await prisma.email.update({
      where: { id: email.id },
      data: { bullJobId: job.id, status: 'SCHEDULED' },
    });
  }
  console.log('✅ State synchronization completed safely.');
}
