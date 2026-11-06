import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { ENV } from '../config/environment';

export const redisConnection = new IORedis(ENV.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const EMAIL_QUEUE_NAME = 'email-outbound-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 604800 },
  },
});
